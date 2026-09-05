package httpapi

import (
	"encoding/json"
	"log"
	"net/http"

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
