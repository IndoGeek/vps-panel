package http

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"

	"github.com/tanmay/vps-panel/backend/internal/agent"
	"github.com/tanmay/vps-panel/backend/internal/auth"
	"github.com/tanmay/vps-panel/backend/internal/identity"
)

func NewRouter(authService *auth.Service) http.Handler {
	mux := http.NewServeMux()

	client := agent.NewClient("http://127.0.0.1:8091")

	// Public endpoint.
	mux.HandleFunc("/api/health", Health)

	// Login.
	mux.HandleFunc("/api/v1/auth/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}

		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		identity, err := authService.Login(
			request.Username,
			request.Password,
		)
		if err != nil {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}

		linuxUser, err := identityForLogin(identity.LinuxUser)
		if err != nil {
			http.Error(
				w,
				"linux user unavailable",
				http.StatusInternalServerError,
			)
			return
		}

		token, err := authService.CreateSession(identity)
		if err != nil {
			http.Error(
				w,
				"failed to create session",
				http.StatusInternalServerError,
			)
			return
		}

		authService.SetCookie(w, token)

		writeJSON(w, http.StatusOK, map[string]any{
			"authenticated": true,
			"user":          linuxUser,
		})
	})

	// Logout.
	mux.HandleFunc("/api/v1/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		authService.Logout(r)
		authService.ClearCookie(w)

		writeJSON(w, http.StatusOK, map[string]bool{
			"authenticated": false,
		})
	})

	// Current authenticated identity.
	mux.HandleFunc("/api/v1/me", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		currentIdentity, ok := authService.Current(r)

		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		linuxUser, err := identityForLogin(currentIdentity.LinuxUser)
		if err != nil {
			http.Error(
				w,
				"linux user unavailable",
				http.StatusInternalServerError,
			)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"authenticated": true,
			"user":          linuxUser,
		})
	})

	// Protected snapshot endpoint.
	mux.HandleFunc("/api/v1/snapshot", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if _, ok := authService.Current(r); !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		snapshot, err := client.Snapshot()
		if err != nil {
			http.Error(
				w,
				"agent unavailable",
				http.StatusBadGateway,
			)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		_, _ = w.Write(snapshot)
	})

	// Protected interactive tmux terminal.
	mux.HandleFunc("/api/v1/tmux/connect", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if _, ok := authService.Current(r); !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		session := r.URL.Query().Get("name")

		if session == "" {
			http.Error(
				w,
				"session name is required",
				http.StatusBadRequest,
			)
			return
		}

		frontendConn, err := terminalUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf(
				"frontend terminal websocket upgrade failed: %v",
				err,
			)
			return
		}

		log.Printf(
			"frontend terminal websocket connected: session=%s remote=%s",
			session,
			r.RemoteAddr,
		)

		defer func() {
			log.Printf(
				"frontend terminal websocket closing: session=%s",
				session,
			)

			_ = frontendConn.Close()
		}()

		agentConn, err := client.ConnectTmuxSession(session)
		if err != nil {
			log.Printf(
				"failed to connect to agent tmux session %q: %v",
				session,
				err,
			)

			_ = frontendConn.WriteControl(
				websocket.CloseMessage,
				websocket.FormatCloseMessage(
					websocket.CloseInternalServerErr,
					"failed to connect to agent",
				),
				time.Now().Add(time.Second),
			)

			return
		}

		defer func() {
			log.Printf(
				"agent websocket closing from backend: session=%s",
				session,
			)

			_ = agentConn.Close()
		}()

		log.Printf(
			"terminal proxy connected: session=%s frontend=%s agent=%s",
			session,
			frontendConn.RemoteAddr(),
			agentConn.RemoteAddr(),
		)

		proxyWebSocket(
			session,
			frontendConn,
			agentConn,
		)

		log.Printf(
			"terminal proxy disconnected: session=%s",
			session,
		)
	})

	return mux
}

var terminalUpgrader = websocket.Upgrader{
	ReadBufferSize:  32 * 1024,
	WriteBufferSize: 32 * 1024,

	// Do not negotiate compression on the browser-facing
	// terminal connection. Terminal traffic is already small
	// and this avoids unnecessary WebSocket extension handling.
	EnableCompression: false,

	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")

		if origin == "" {
			return true
		}

		return origin == "http://"+r.Host ||
			origin == "https://"+r.Host
	},
}

func proxyWebSocket(
	session string,
	frontendConn *websocket.Conn,
	agentConn *websocket.Conn,
) {
	errors := make(chan error, 2)

	// Browser -> agent.
	go func() {
		for {
			messageType, payload, err := frontendConn.ReadMessage()
			if err != nil {
				log.Printf(
					"terminal proxy frontend read ended: session=%s error=%v",
					session,
					err,
				)

				errors <- err
				return
			}

			if err := agentConn.WriteMessage(
				messageType,
				payload,
			); err != nil {
				log.Printf(
					"terminal proxy agent write failed: session=%s error=%v",
					session,
					err,
				)

				errors <- err
				return
			}
		}
	}()

	// Agent -> browser.
	go func() {
		for {
			messageType, payload, err := agentConn.ReadMessage()
			if err != nil {
				log.Printf(
					"terminal proxy agent read ended: session=%s error=%v",
					session,
					err,
				)

				errors <- err
				return
			}

			if err := frontendConn.WriteMessage(
				messageType,
				payload,
			); err != nil {
				log.Printf(
					"terminal proxy frontend write failed: session=%s error=%v",
					session,
					err,
				)

				errors <- err
				return
			}
		}
	}()

	// Keep the connection alive and make broken connections
	// detectable rather than silently waiting forever.
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			deadline := time.Now().Add(5 * time.Second)

			if err := frontendConn.WriteControl(
				websocket.PingMessage,
				nil,
				deadline,
			); err != nil {
				log.Printf(
					"terminal proxy frontend ping failed: session=%s error=%v",
					session,
					err,
				)
				return
			}

			if err := agentConn.WriteControl(
				websocket.PingMessage,
				nil,
				deadline,
			); err != nil {
				log.Printf(
					"terminal proxy agent ping failed: session=%s error=%v",
					session,
					err,
				)
				return
			}
		}
	}()

	// Wait for either direction to terminate.
	err := <-errors

	log.Printf(
		"terminal proxy relay stopping: session=%s reason=%v",
		session,
		err,
	)

	// Send a proper close frame instead of simply dropping TCP.
	closeMessage := websocket.FormatCloseMessage(
		websocket.CloseNormalClosure,
		"terminal proxy closed",
	)

	_ = frontendConn.WriteControl(
		websocket.CloseMessage,
		closeMessage,
		time.Now().Add(time.Second),
	)

	_ = agentConn.WriteControl(
		websocket.CloseMessage,
		closeMessage,
		time.Now().Add(time.Second),
	)

	_ = frontendConn.Close()
	_ = agentConn.Close()
}

func identityForLogin(username string) (identity.LinuxUser, error) {
	return identity.Lookup(username)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(value)
}
