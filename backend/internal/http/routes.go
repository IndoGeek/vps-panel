package http

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/tanmay/vps-panel/backend/internal/agent"
	"github.com/tanmay/vps-panel/backend/internal/audit"
	"github.com/tanmay/vps-panel/backend/internal/auth"
	"github.com/tanmay/vps-panel/backend/internal/identity"
)

func NewRouter(
	authService *auth.Service,
	auditStore *audit.Store,
	agentURL string,
) http.Handler {
	mux := http.NewServeMux()

	client := agent.NewClient(agentURL)

	// Public endpoint.
	mux.HandleFunc(
		"/api/health",
		Health,
	)

	// Login.
	mux.HandleFunc(
		"/api/v1/auth/login",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				http.Error(
					w,
					"method not allowed",
					http.StatusMethodNotAllowed,
				)
				return
			}

			var request struct {
				Username string `json:"username"`
				Password string `json:"password"`
			}

			if err := json.NewDecoder(
				r.Body,
			).Decode(&request); err != nil {
				http.Error(
					w,
					"invalid request",
					http.StatusBadRequest,
				)
				return
			}

			identity, err := authService.Login(
				request.Username,
				request.Password,
			)
			if err != nil {
				recordAudit(
					r,
					auditStore,
					audit.Event{
						Username:  request.Username,
						Action:    "auth.login",
						Status:    "denied",
						IPAddress: clientIPAddress(r),
						UserAgent: r.UserAgent(),
						Details:   "invalid credentials",
					},
				)

				http.Error(
					w,
					"invalid credentials",
					http.StatusUnauthorized,
				)
				return
			}

			linuxUser, err := identityForLogin(
				identity.LinuxUser,
			)
			if err != nil {
				recordAudit(
					r,
					auditStore,
					audit.Event{
						Username:  identity.Username,
						Action:    "auth.login",
						Status:    "failure",
						IPAddress: clientIPAddress(r),
						UserAgent: r.UserAgent(),
						Details:   "linux user unavailable",
					},
				)

				http.Error(
					w,
					"linux user unavailable",
					http.StatusInternalServerError,
				)
				return
			}

			token, err := authService.CreateSession(
				identity,
			)
			if err != nil {
				recordAudit(
					r,
					auditStore,
					audit.Event{
						Username:  identity.Username,
						Action:    "auth.login",
						Status:    "failure",
						IPAddress: clientIPAddress(r),
						UserAgent: r.UserAgent(),
						Details:   "failed to create session",
					},
				)

				http.Error(
					w,
					"failed to create session",
					http.StatusInternalServerError,
				)
				return
			}

			authService.SetCookie(
				w,
				token,
			)

			recordAudit(
				r,
				auditStore,
				audit.Event{
					Username:  identity.Username,
					Action:    "auth.login",
					Status:    "success",
					IPAddress: clientIPAddress(r),
					UserAgent: r.UserAgent(),
					Details:   "login successful",
				},
			)

			writeJSON(
				w,
				http.StatusOK,
				map[string]any{
					"authenticated": true,
					"user":          linuxUser,
				},
			)
		},
	)

	// Logout.
	mux.HandleFunc(
		"/api/v1/auth/logout",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				http.Error(
					w,
					"method not allowed",
					http.StatusMethodNotAllowed,
				)
				return
			}

			currentIdentity, authenticated := authService.Current(r)

			authService.Logout(r)
			authService.ClearCookie(w)

			if authenticated {
				recordAudit(
					r,
					auditStore,
					audit.Event{
						Username:  currentIdentity.Username,
						Action:    "auth.logout",
						Status:    "success",
						IPAddress: clientIPAddress(r),
						UserAgent: r.UserAgent(),
						Details:   "logout successful",
					},
				)
			}

			writeJSON(
				w,
				http.StatusOK,
				map[string]bool{
					"authenticated": false,
				},
			)
		},
	)

	// Current authenticated identity.
	mux.HandleFunc(
		"/api/v1/me",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				http.Error(
					w,
					"method not allowed",
					http.StatusMethodNotAllowed,
				)
				return
			}

			currentIdentity, ok := authService.Current(r)

			if !ok {
				http.Error(
					w,
					"unauthorized",
					http.StatusUnauthorized,
				)
				return
			}

			linuxUser, err := identityForLogin(
				currentIdentity.LinuxUser,
			)
			if err != nil {
				http.Error(
					w,
					"linux user unavailable",
					http.StatusInternalServerError,
				)
				return
			}

			writeJSON(
				w,
				http.StatusOK,
				map[string]any{
					"authenticated": true,
					"user":          linuxUser,
				},
			)
		},
	)

	// Protected snapshot endpoint.
	mux.HandleFunc(
		"/api/v1/snapshot",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				http.Error(
					w,
					"method not allowed",
					http.StatusMethodNotAllowed,
				)
				return
			}

			if _, ok := authService.Current(r); !ok {
				http.Error(
					w,
					"unauthorized",
					http.StatusUnauthorized,
				)
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

			w.Header().Set(
				"Content-Type",
				"application/json",
			)

			w.WriteHeader(http.StatusOK)

			_, _ = w.Write(snapshot)
		},
	)

	// Protected audit endpoint.
	mux.HandleFunc(
		"/api/v1/audit",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				http.Error(
					w,
					"method not allowed",
					http.StatusMethodNotAllowed,
				)
				return
			}

			if _, ok := authService.Current(r); !ok {
				http.Error(
					w,
					"unauthorized",
					http.StatusUnauthorized,
				)
				return
			}

			limit := parseIntQuery(
				r,
				"limit",
				50,
			)

			offset := parseIntQuery(
				r,
				"offset",
				0,
			)

			action := strings.TrimSpace(
				r.URL.Query().Get("action"),
			)

			status := strings.TrimSpace(
				r.URL.Query().Get("status"),
			)

			entries, total, err := auditStore.List(
				r.Context(),
				limit,
				offset,
				action,
				status,
			)
			if err != nil {
				log.Printf(
					"failed to list audit logs: %v",
					err,
				)

				http.Error(
					w,
					"failed to load audit logs",
					http.StatusInternalServerError,
				)
				return
			}

			writeJSON(
				w,
				http.StatusOK,
				map[string]any{
					"entries": entries,
					"total":   total,
					"limit":   limit,
					"offset":  offset,
				},
			)
		},
	)

	// Protected interactive tmux terminal.
	mux.HandleFunc(
		"/api/v1/tmux/connect",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				http.Error(
					w,
					"method not allowed",
					http.StatusMethodNotAllowed,
				)
				return
			}

			currentIdentity, ok := authService.Current(r)

			if !ok {
				http.Error(
					w,
					"unauthorized",
					http.StatusUnauthorized,
				)
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

			frontendConn, err := terminalUpgrader.Upgrade(
				w,
				r,
				nil,
			)
			if err != nil {
				log.Printf(
					"frontend terminal websocket upgrade failed: %v",
					err,
				)

				recordAudit(
					r,
					auditStore,
					audit.Event{
						Username:     currentIdentity.Username,
						Action:       "terminal.connect",
						ResourceType: "tmux_session",
						ResourceName: session,
						Status:       "failure",
						IPAddress:    clientIPAddress(r),
						UserAgent:    r.UserAgent(),
						Details:      "browser websocket upgrade failed",
					},
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

			agentConn, err := client.ConnectTmuxSession(
				session,
			)
			if err != nil {
				log.Printf(
					"failed to connect to agent tmux session %q: %v",
					session,
					err,
				)

				recordAudit(
					r,
					auditStore,
					audit.Event{
						Username:     currentIdentity.Username,
						Action:       "terminal.connect",
						ResourceType: "tmux_session",
						ResourceName: session,
						Status:       "failure",
						IPAddress:    clientIPAddress(r),
						UserAgent:    r.UserAgent(),
						Details:      "agent tmux connection failed",
					},
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

			recordAudit(
				r,
				auditStore,
				audit.Event{
					Username:     currentIdentity.Username,
					Action:       "terminal.connect",
					ResourceType: "tmux_session",
					ResourceName: session,
					Status:       "success",
					IPAddress:    clientIPAddress(r),
					UserAgent:    r.UserAgent(),
					Details:      "terminal connected",
				},
			)

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

			/*
			 * IMPORTANT:
			 *
			 * This is the existing working terminal
			 * proxy. Do not change its relay behavior.
			 */
			proxyWebSocket(
				session,
				frontendConn,
				agentConn,
			)

			recordAudit(
				r,
				auditStore,
				audit.Event{
					Username:     currentIdentity.Username,
					Action:       "terminal.disconnect",
					ResourceType: "tmux_session",
					ResourceName: session,
					Status:       "success",
					IPAddress:    clientIPAddress(r),
					UserAgent:    r.UserAgent(),
					Details:      "terminal disconnected",
				},
			)

			log.Printf(
				"terminal proxy disconnected: session=%s",
				session,
			)
		},
	)

	return mux
}

var terminalUpgrader = websocket.Upgrader{
	ReadBufferSize:  32 * 1024,
	WriteBufferSize: 32 * 1024,

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
	errors := make(chan error, 3)

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

	// Heartbeat.
	go func() {
		ticker := time.NewTicker(
			30 * time.Second,
		)

		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				deadline := time.Now().Add(
					5 * time.Second,
				)

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

					errors <- err
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

					errors <- err
					return
				}
			}
		}
	}()

	err := <-errors

	log.Printf(
		"terminal proxy relay stopping: session=%s reason=%v",
		session,
		err,
	)

	closeMessage := websocket.FormatCloseMessage(
		websocket.CloseNormalClosure,
		"terminal proxy closed",
	)

	deadline := time.Now().Add(
		time.Second,
	)

	_ = frontendConn.WriteControl(
		websocket.CloseMessage,
		closeMessage,
		deadline,
	)

	_ = agentConn.WriteControl(
		websocket.CloseMessage,
		closeMessage,
		deadline,
	)

	_ = frontendConn.Close()
	_ = agentConn.Close()
}

func identityForLogin(
	username string,
) (identity.LinuxUser, error) {
	return identity.Lookup(username)
}

func recordAudit(
	r *http.Request,
	store *audit.Store,
	event audit.Event,
) {
	if store == nil {
		return
	}

	if event.IPAddress == "" {
		event.IPAddress = clientIPAddress(r)
	}

	if event.UserAgent == "" {
		event.UserAgent = r.UserAgent()
	}

	if err := store.Record(
		r.Context(),
		event,
	); err != nil {
		log.Printf(
			"audit record failed: action=%s status=%s resource=%s/%s error=%v",
			event.Action,
			event.Status,
			event.ResourceType,
			event.ResourceName,
			err,
		)
	}
}

func clientIPAddress(
	r *http.Request,
) string {
	if forwarded := r.Header.Get(
		"X-Forwarded-For",
	); forwarded != "" {
		first := strings.TrimSpace(
			strings.Split(
				forwarded,
				",",
			)[0],
		)

		if first != "" &&
			net.ParseIP(first) != nil {
			return first
		}
	}

	if realIP := strings.TrimSpace(
		r.Header.Get("X-Real-IP"),
	); realIP != "" {
		if net.ParseIP(realIP) != nil {
			return realIP
		}
	}

	host, _, err := net.SplitHostPort(
		r.RemoteAddr,
	)

	if err == nil {
		return host
	}

	return r.RemoteAddr
}

func parseIntQuery(
	r *http.Request,
	name string,
	fallback int,
) int {
	value, err := strconv.Atoi(
		r.URL.Query().Get(name),
	)
	if err != nil {
		return fallback
	}

	return value
}

func writeJSON(
	w http.ResponseWriter,
	status int,
	value any,
) {
	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	w.WriteHeader(status)

	_ = json.NewEncoder(
		w,
	).Encode(value)
}
