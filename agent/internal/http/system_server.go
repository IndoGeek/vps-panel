package httpapi

import (
	"log"
	"net/http"
)

func (s *Server) ListenAndServeWithSystem() error {
	mux := http.NewServeMux()

	/*
		Existing agent endpoints.
	*/

	mux.HandleFunc(
		"/api/v1/snapshot",
		s.handleSnapshot,
	)

	mux.HandleFunc(
		"/api/v1/tmux/session",
		s.handleTmuxSession,
	)

	mux.HandleFunc(
		"/api/v1/tmux/connect",
		s.handleTmuxConnect,
	)

	mux.HandleFunc(
		"/api/health",
		s.handleHealth,
	)

	/*
		Phase 9.1 system-management endpoints.
	*/

	registerSystemRoutes(mux)

	/*
		Phase 9.2 + 9.3 service/process management.
	*/

	registerManagementRoutes(mux)

	log.Printf(
		"VPS Panel agent API starting on %s",
		s.addr,
	)

	return http.ListenAndServe(
		s.addr,
		mux,
	)
}
