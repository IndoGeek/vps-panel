package httpapi

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/tanmay/vps-panel/agent/internal/process"
	"github.com/tanmay/vps-panel/agent/internal/service"
)

func registerManagementRoutes(
	mux *http.ServeMux,
) {
	mux.HandleFunc(
		"/api/v1/services",
		handleServices,
	)

	mux.HandleFunc(
		"/api/v1/services/",
		handleServiceAction,
	)

	mux.HandleFunc(
		"/api/v1/processes",
		handleProcesses,
	)

	mux.HandleFunc(
		"/api/v1/processes/",
		handleProcessAction,
	)
}

func handleServices(
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

	services, err := service.ListServices()
	if err != nil {
		http.Error(
			w,
			"failed to list services",
			http.StatusInternalServerError,
		)
		return
	}

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"services": services,
		},
	)
}

func handleServiceAction(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	path := strings.TrimPrefix(
		r.URL.Path,
		"/api/v1/services/",
	)

	parts := strings.Split(
		strings.Trim(path, "/"),
		"/",
	)

	if len(parts) != 2 {
		http.Error(
			w,
			"invalid service path",
			http.StatusBadRequest,
		)
		return
	}

	name, err := url.PathUnescape(parts[0])
	if err != nil ||
		strings.TrimSpace(name) == "" {
		http.Error(
			w,
			"invalid service name",
			http.StatusBadRequest,
		)
		return
	}

	action := strings.TrimSpace(parts[1])

	if err := service.ManageService(
		name,
		action,
	); err != nil {
		status := http.StatusInternalServerError

		if strings.Contains(
			err.Error(),
			"unsupported service action",
		) ||
			strings.Contains(
				err.Error(),
				"service name is required",
			) {
			status = http.StatusBadRequest
		}

		writeJSON(
			w,
			status,
			map[string]any{
				"success": false,
				"service": name,
				"action":  action,
				"error":   err.Error(),
			},
		)

		return
	}

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"success": true,
			"service": name,
			"action":  action,
		},
	)
}

func handleProcesses(
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

	processes, err := process.ListProcesses()
	if err != nil {
		http.Error(
			w,
			"failed to list processes",
			http.StatusInternalServerError,
		)
		return
	}

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"processes": processes,
		},
	)
}

func handleProcessAction(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	path := strings.TrimPrefix(
		r.URL.Path,
		"/api/v1/processes/",
	)

	parts := strings.Split(
		strings.Trim(path, "/"),
		"/",
	)

	if len(parts) != 2 ||
		parts[1] != "kill" {
		http.Error(
			w,
			"invalid process path",
			http.StatusBadRequest,
		)
		return
	}

	pid, err := strconv.Atoi(parts[0])
	if err != nil || pid <= 0 {
		http.Error(
			w,
			"invalid PID",
			http.StatusBadRequest,
		)
		return
	}

	var request struct {
		Signal string `json:"signal"`
	}

	if r.Body != nil {
		_ = json.NewDecoder(
			r.Body,
		).Decode(&request)
	}

	request.Signal = strings.ToUpper(
		strings.TrimSpace(request.Signal),
	)

	if request.Signal == "" {
		request.Signal = "TERM"
	}

	if err := process.KillProcess(
		pid,
		request.Signal,
	); err != nil {
		status := http.StatusInternalServerError

		if strings.Contains(
			err.Error(),
			"protected PID",
		) ||
			strings.Contains(
				err.Error(),
				"unsupported process signal",
			) {
			status = http.StatusBadRequest
		}

		writeJSON(
			w,
			status,
			map[string]any{
				"success": false,
				"pid":     pid,
				"signal":  request.Signal,
				"error":   err.Error(),
			},
		)

		return
	}

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"success": true,
			"pid":     pid,
			"signal":  request.Signal,
		},
	)
}
