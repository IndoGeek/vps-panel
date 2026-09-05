package httpapi

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os/exec"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"

	agentcore "github.com/tanmay/vps-panel/agent/internal/agent"
	"github.com/tanmay/vps-panel/agent/internal/tmux"
)

type Server struct {
	addr string
}

func NewServer(addr string) *Server {
	return &Server{
		addr: addr,
	}
}

func (s *Server) ListenAndServe() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/snapshot", s.handleSnapshot)
	mux.HandleFunc("/api/v1/tmux/session", s.handleTmuxSession)
	mux.HandleFunc("/api/v1/tmux/connect", s.handleTmuxConnect)
	mux.HandleFunc("/api/health", s.handleHealth)

	log.Printf("VPS Panel agent API starting on %s", s.addr)

	return http.ListenAndServe(s.addr, mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func (s *Server) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	snapshot, err := agentcore.Collect()
	if err != nil {
		log.Printf("failed to collect snapshot: %v", err)

		http.Error(
			w,
			"failed to collect snapshot",
			http.StatusInternalServerError,
		)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(snapshot); err != nil {
		log.Printf("failed to encode snapshot: %v", err)
	}
}

func (s *Server) handleTmuxSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
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

	if !tmux.HasSession(session) {
		http.Error(
			w,
			"tmux session not found",
			http.StatusNotFound,
		)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]any{
		"session":   session,
		"available": true,
	})
}

var tmuxUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,

	// The agent WebSocket is only intended to be reached by the
	// backend on the server itself. The backend's WebSocket client
	// does not send a browser Origin header.
	CheckOrigin: func(r *http.Request) bool {
		return r.Header.Get("Origin") == ""
	},
}

type resizeMessage struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

func (s *Server) handleTmuxConnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
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

	if !tmux.HasSession(session) {
		http.Error(
			w,
			"tmux session not found",
			http.StatusNotFound,
		)
		return
	}

	conn, err := tmuxUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("tmux websocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("tmux terminal connected: %s", session)

	command := exec.Command(
		"tmux",
		"attach-session",
		"-t",
		session,
	)

	terminal, err := pty.Start(command)
	if err != nil {
		log.Printf(
			"failed to start tmux session %q: %v",
			session,
			err,
		)

		_ = conn.WriteMessage(
			websocket.TextMessage,
			[]byte("Failed to attach to tmux session.\r\n"),
		)

		return
	}

	defer terminal.Close()

	commandDone := make(chan error, 1)

	go func() {
		commandDone <- command.Wait()
	}()

	// PTY -> WebSocket
	outputDone := make(chan struct{})

	go func() {
		defer close(outputDone)

		buffer := make([]byte, 32*1024)

		for {
			n, readErr := terminal.Read(buffer)

			if n > 0 {
				if writeErr := conn.WriteMessage(
					websocket.BinaryMessage,
					buffer[:n],
				); writeErr != nil {
					return
				}
			}

			if readErr != nil {
				return
			}
		}
	}()

	// WebSocket -> PTY
	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			break
		}

		switch messageType {
		case websocket.TextMessage, websocket.BinaryMessage:
			var resize resizeMessage

			if messageType == websocket.TextMessage &&
				json.Unmarshal(payload, &resize) == nil &&
				resize.Type == "resize" &&
				resize.Cols > 0 &&
				resize.Rows > 0 {
				if err := pty.Setsize(terminal, &pty.Winsize{
					Cols: resize.Cols,
					Rows: resize.Rows,
				}); err != nil {
					log.Printf(
						"failed to resize tmux session %q: %v",
						session,
						err,
					)
				}

				continue
			}

			if _, err := terminal.Write(payload); err != nil {
				break
			}
		}
	}

	_ = terminal.Close()

	select {
	case err := <-commandDone:
		if err != nil {
			log.Printf(
				"tmux session %q ended: %v",
				session,
				err,
			)
		}
	case <-outputDone:
	}

	log.Printf("tmux terminal disconnected: %s", session)

	// Keep io imported intentionally as part of the terminal implementation
	// contract for future streaming changes.
	_ = io.EOF
}
