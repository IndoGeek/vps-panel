package httpapi

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	agentcore "github.com/tanmay/vps-panel/agent/internal/agent"
	"github.com/tanmay/vps-panel/agent/internal/tmux"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
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

func (s *Server) handleHealth(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	_ = json.NewEncoder(w).Encode(
		map[string]string{
			"status": "ok",
		},
	)
}

func (s *Server) handleSnapshot(
	w http.ResponseWriter,
	r *http.Request,
) {
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
		log.Printf(
			"failed to collect snapshot: %v",
			err,
		)

		http.Error(
			w,
			"failed to collect snapshot",
			http.StatusInternalServerError,
		)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	if err := json.NewEncoder(
		w,
	).Encode(snapshot); err != nil {
		log.Printf(
			"failed to encode snapshot: %v",
			err,
		)
	}
}

/*
handleTmuxSession provides the non-interactive tmux
session management API.

# GET

Without a name:

	list all sessions.

With ?name=NAME:

	check whether a specific session exists.

# POST

Without action:

	create a session.

?action=detach&name=NAME:

	detach clients from a session.

# PATCH

Rename a session.

# DELETE

Delete a session.

The interactive terminal endpoint remains completely
separate in handleTmuxConnect.
*/
func (s *Server) handleTmuxSession(
	w http.ResponseWriter,
	r *http.Request,
) {
	switch r.Method {
	case http.MethodGet:
		s.handleTmuxSessionGet(w, r)

	case http.MethodPost:
		s.handleTmuxSessionPost(w, r)

	case http.MethodPatch:
		s.handleTmuxSessionPatch(w, r)

	case http.MethodDelete:
		s.handleTmuxSessionDelete(w, r)

	default:
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
	}
}

func (s *Server) handleTmuxSessionGet(
	w http.ResponseWriter,
	r *http.Request,
) {
	session := strings.TrimSpace(
		r.URL.Query().Get("name"),
	)

	/*
		No name means "list sessions".
	*/
	if session == "" {
		sessions, err := tmux.ListSessions()
		if err != nil {
			log.Printf(
				"failed to list tmux sessions: %v",
				err,
			)

			http.Error(
				w,
				"failed to list tmux sessions",
				http.StatusInternalServerError,
			)
			return
		}

		writeJSON(
			w,
			http.StatusOK,
			map[string]any{
				"sessions": sessions,
			},
		)

		return
	}

	/*
		With a name, preserve the existing session
		existence check used by the terminal flow.
	*/
	if !tmux.HasSession(session) {
		http.Error(
			w,
			"tmux session not found",
			http.StatusNotFound,
		)
		return
	}

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"session":   session,
			"available": true,
		},
	)
}

type createTmuxSessionRequest struct {
	Name string `json:"name"`
}

func (s *Server) handleTmuxSessionPost(
	w http.ResponseWriter,
	r *http.Request,
) {
	action := strings.TrimSpace(
		r.URL.Query().Get("action"),
	)

	/*
		POST ?action=detach&name=NAME
	*/
	if action == "detach" {
		session := strings.TrimSpace(
			r.URL.Query().Get("name"),
		)

		if session == "" {
			http.Error(
				w,
				"session name is required",
				http.StatusBadRequest,
			)
			return
		}

		if err := tmux.DetachSession(session); err != nil {
			status := tmuxManagementErrorStatus(err)

			log.Printf(
				"failed to detach tmux session %q: %v",
				session,
				err,
			)

			http.Error(
				w,
				err.Error(),
				status,
			)

			return
		}

		writeJSON(
			w,
			http.StatusOK,
			map[string]any{
				"session": session,
				"action":  "detach",
				"success": true,
			},
		)

		return
	}

	/*
		Normal POST creates a new session.
	*/
	var request createTmuxSessionRequest

	if err := json.NewDecoder(
		r.Body,
	).Decode(&request); err != nil {
		http.Error(
			w,
			"invalid request body",
			http.StatusBadRequest,
		)
		return
	}

	request.Name = strings.TrimSpace(
		request.Name,
	)

	if request.Name == "" {
		http.Error(
			w,
			"session name is required",
			http.StatusBadRequest,
		)
		return
	}

	if err := tmux.CreateSession(
		request.Name,
	); err != nil {
		status := tmuxManagementErrorStatus(err)

		log.Printf(
			"failed to create tmux session %q: %v",
			request.Name,
			err,
		)

		http.Error(
			w,
			err.Error(),
			status,
		)

		return
	}

	writeJSON(
		w,
		http.StatusCreated,
		map[string]any{
			"session": request.Name,
			"success": true,
		},
	)
}

type renameTmuxSessionRequest struct {
	Name string `json:"name"`
}

func (s *Server) handleTmuxSessionPatch(
	w http.ResponseWriter,
	r *http.Request,
) {
	currentName := strings.TrimSpace(
		r.URL.Query().Get("name"),
	)

	if currentName == "" {
		http.Error(
			w,
			"session name is required",
			http.StatusBadRequest,
		)
		return
	}

	var request renameTmuxSessionRequest

	if err := json.NewDecoder(
		r.Body,
	).Decode(&request); err != nil {
		http.Error(
			w,
			"invalid request body",
			http.StatusBadRequest,
		)
		return
	}

	request.Name = strings.TrimSpace(
		request.Name,
	)

	if request.Name == "" {
		http.Error(
			w,
			"new session name is required",
			http.StatusBadRequest,
		)
		return
	}

	if err := tmux.RenameSession(
		currentName,
		request.Name,
	); err != nil {
		status := tmuxManagementErrorStatus(err)

		log.Printf(
			"failed to rename tmux session %q to %q: %v",
			currentName,
			request.Name,
			err,
		)

		http.Error(
			w,
			err.Error(),
			status,
		)

		return
	}

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"session":  request.Name,
			"previous": currentName,
			"success":  true,
			"action":   "rename",
		},
	)
}

func (s *Server) handleTmuxSessionDelete(
	w http.ResponseWriter,
	r *http.Request,
) {
	session := strings.TrimSpace(
		r.URL.Query().Get("name"),
	)

	if session == "" {
		http.Error(
			w,
			"session name is required",
			http.StatusBadRequest,
		)
		return
	}

	if err := tmux.DeleteSession(session); err != nil {
		status := tmuxManagementErrorStatus(err)

		log.Printf(
			"failed to delete tmux session %q: %v",
			session,
			err,
		)

		http.Error(
			w,
			err.Error(),
			status,
		)

		return
	}

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"session": session,
			"success": true,
			"action":  "delete",
		},
	)
}

func tmuxManagementErrorStatus(
	err error,
) int {
	message := strings.ToLower(
		err.Error(),
	)

	switch {
	case strings.Contains(
		message,
		"not found",
	):
		return http.StatusNotFound

	case strings.Contains(
		message,
		"already exists",
	):
		return http.StatusConflict

	case strings.Contains(
		message,
		"required",
	):
		return http.StatusBadRequest

	case strings.Contains(
		message,
		"may contain only",
	):
		return http.StatusBadRequest

	case strings.Contains(
		message,
		"must not exceed",
	):
		return http.StatusBadRequest

	case strings.Contains(
		message,
		"same as",
	):
		return http.StatusBadRequest

	default:
		return http.StatusInternalServerError
	}
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

var tmuxUpgrader = websocket.Upgrader{
	ReadBufferSize:  32 * 1024,
	WriteBufferSize: 32 * 1024,

	EnableCompression: false,

	CheckOrigin: func(r *http.Request) bool {
		// The agent is intentionally localhost-only.
		// The backend connects without an Origin header.
		return r.Header.Get("Origin") == ""
	},
}

type resizeMessage struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

func tmuxCommandEnvironment() []string {
	current := os.Environ()

	environment := make([]string, 0, len(current)+1)

	for _, value := range current {
		if strings.HasPrefix(value, "TMUX=") {
			continue
		}

		environment = append(
			environment,
			value,
		)
	}

	term := os.Getenv("TERM")

	if term == "" || term == "dumb" {
		environment = append(
			environment,
			"TERM=xterm-256color",
		)
	}

	return environment
}

func (s *Server) handleTmuxConnect(
	w http.ResponseWriter,
	r *http.Request,
) {
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

	conn, err := tmuxUpgrader.Upgrade(
		w,
		r,
		nil,
	)
	if err != nil {
		log.Printf(
			"tmux websocket upgrade failed: session=%s error=%v",
			session,
			err,
		)

		return
	}

	log.Printf(
		"tmux terminal connected: session=%s remote=%s",
		session,
		r.RemoteAddr,
	)

	defer func() {
		log.Printf(
			"tmux terminal websocket closing: session=%s",
			session,
		)

		_ = conn.Close()
	}()

	command := exec.Command(
		"tmux",
		"attach-session",
		"-t",
		session,
	)

	command.Env = tmuxCommandEnvironment()

	terminal, err := pty.Start(command)
	if err != nil {
		log.Printf(
			"failed to start tmux session: session=%s error=%v",
			session,
			err,
		)

		_ = conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(
				websocket.CloseInternalServerErr,
				"failed to attach to tmux",
			),
			time.Now().Add(time.Second),
		)

		return
	}

	defer terminal.Close()

	commandDone := make(chan error, 1)

	go func() {
		err := command.Wait()

		commandDone <- err
	}()

	outputDone := make(chan struct{})

	// PTY -> WebSocket.
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
					log.Printf(
						"tmux terminal websocket write failed: session=%s error=%v",
						session,
						writeErr,
					)

					return
				}
			}

			if readErr != nil {
				log.Printf(
					"tmux PTY read ended: session=%s error=%v",
					session,
					readErr,
				)

				return
			}
		}
	}()

	// WebSocket -> PTY.
	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			log.Printf(
				"tmux terminal websocket read ended: session=%s error=%v",
				session,
				err,
			)

			break
		}

		switch messageType {
		case websocket.TextMessage, websocket.BinaryMessage:
			var resize resizeMessage

			if messageType == websocket.TextMessage &&
				json.Unmarshal(
					payload,
					&resize,
				) == nil &&
				resize.Type == "resize" &&
				resize.Cols > 0 &&
				resize.Rows > 0 {

				if err := pty.Setsize(
					terminal,
					&pty.Winsize{
						Cols: resize.Cols,
						Rows: resize.Rows,
					},
				); err != nil {
					log.Printf(
						"failed to resize tmux session: session=%s error=%v",
						session,
						err,
					)
				}

				continue
			}

			if _, err := terminal.Write(
				payload,
			); err != nil {
				log.Printf(
					"failed to write to tmux PTY: session=%s error=%v",
					session,
					err,
				)

				break
			}
		}
	}

	// Closing the PTY causes the output goroutine to terminate.
	_ = terminal.Close()

	select {
	case err := <-commandDone:
		if err != nil {
			log.Printf(
				"tmux command exited with error: session=%s error=%v",
				session,
				err,
			)
		} else {
			log.Printf(
				"tmux command exited normally: session=%s",
				session,
			)
		}

	case <-outputDone:
		log.Printf(
			"tmux PTY output ended: session=%s",
			session,
		)
	}

	log.Printf(
		"tmux terminal disconnected: session=%s",
		session,
	)
}
