package http

import (
	"net/http"

	"github.com/tanmay/vps-panel/backend/internal/agent"
)

func NewRouter() http.Handler {
	mux := http.NewServeMux()

	client := agent.NewClient("http://127.0.0.1:8091")

	mux.HandleFunc("/api/health", Health)

	mux.HandleFunc("/api/v1/snapshot", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		snapshot, err := client.Snapshot()
		if err != nil {
			http.Error(w, "agent unavailable", http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(snapshot)
	})

	return mux
}
