package http

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/tanmay/vps-panel/backend/internal/agent"
	"github.com/tanmay/vps-panel/backend/internal/audit"
	"github.com/tanmay/vps-panel/backend/internal/auth"
)

func managementWrapper(
	next http.Handler,
	authService *auth.Service,
	auditStore *audit.Store,
	agentURL string,
) http.Handler {
	client := agent.NewClient(agentURL)

	return http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			switch {
			case r.URL.Path == "/api/v1/services" &&
				r.Method == http.MethodGet:

				handleServiceList(
					w,
					r,
					authService,
					client,
				)

			case strings.HasPrefix(
				r.URL.Path,
				"/api/v1/services/",
			):

				handleServiceAction(
					w,
					r,
					authService,
					auditStore,
					client,
				)

			case r.URL.Path == "/api/v1/processes" &&
				r.Method == http.MethodGet:

				handleProcessList(
					w,
					r,
					authService,
					client,
				)

			case strings.HasPrefix(
				r.URL.Path,
				"/api/v1/processes/",
			):

				handleProcessAction(
					w,
					r,
					authService,
					auditStore,
					client,
				)

			default:
				next.ServeHTTP(w, r)
			}
		},
	)
}

func handleServiceList(
	w http.ResponseWriter,
	r *http.Request,
	authService *auth.Service,
	client *agent.Client,
) {
	if _, ok := authService.Current(r); !ok {
		http.Error(
			w,
			"unauthorized",
			http.StatusUnauthorized,
		)
		return
	}

	services, err := client.ListServices()
	if err != nil {
		log.Printf(
			"failed to list services: %v",
			err,
		)

		writeManagementAgentError(
			w,
			err,
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
	authService *auth.Service,
	auditStore *audit.Store,
	client *agent.Client,
) {
	if r.Method != http.MethodPost {
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

	path := strings.TrimPrefix(
		r.URL.Path,
		"/api/v1/services/",
	)

	parts := strings.Split(
		strings.Trim(path, "/"),
		"/",
	)

	if len(parts) != 2 ||
		strings.TrimSpace(parts[0]) == "" {
		http.Error(
			w,
			"invalid service path",
			http.StatusBadRequest,
		)
		return
	}

	serviceName := strings.TrimSpace(parts[0])
	action := strings.TrimSpace(parts[1])

	if !isServiceAction(action) {
		http.Error(
			w,
			"invalid service action",
			http.StatusBadRequest,
		)
		return
	}

	err := client.ManageService(
		serviceName,
		action,
	)
	if err != nil {
		recordManagementAudit(
			r,
			auditStore,
			audit.Event{
				Username:     currentIdentity.Username,
				Action:       "service." + action,
				ResourceType: "service",
				ResourceName: serviceName,
				Status:       "failure",
				Details:      err.Error(),
			},
		)

		writeManagementAgentError(
			w,
			err,
		)

		return
	}

	recordManagementAudit(
		r,
		auditStore,
		audit.Event{
			Username:     currentIdentity.Username,
			Action:       "service." + action,
			ResourceType: "service",
			ResourceName: serviceName,
			Status:       "success",
			Details:      "service " + action + " completed",
		},
	)

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"success": true,
			"service": serviceName,
			"action":  action,
		},
	)
}

func handleProcessList(
	w http.ResponseWriter,
	r *http.Request,
	authService *auth.Service,
	client *agent.Client,
) {
	if _, ok := authService.Current(r); !ok {
		http.Error(
			w,
			"unauthorized",
			http.StatusUnauthorized,
		)
		return
	}

	processes, err := client.ListProcesses()
	if err != nil {
		log.Printf(
			"failed to list processes: %v",
			err,
		)

		writeManagementAgentError(
			w,
			err,
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
	authService *auth.Service,
	auditStore *audit.Store,
	client *agent.Client,
) {
	if r.Method != http.MethodPost {
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

	decodeErr := json.NewDecoder(
		r.Body,
	).Decode(&request)

	if decodeErr != nil &&
		decodeErr.Error() != "EOF" {
		http.Error(
			w,
			"invalid request body",
			http.StatusBadRequest,
		)
		return
	}

	request.Signal = strings.ToUpper(
		strings.TrimSpace(request.Signal),
	)

	if request.Signal == "" {
		request.Signal = "TERM"
	}

	if request.Signal != "TERM" &&
		request.Signal != "SIGTERM" &&
		request.Signal != "KILL" &&
		request.Signal != "SIGKILL" {
		http.Error(
			w,
			"unsupported process signal",
			http.StatusBadRequest,
		)
		return
	}

	err = client.KillProcess(
		pid,
		request.Signal,
	)
	if err != nil {
		recordManagementAudit(
			r,
			auditStore,
			audit.Event{
				Username:     currentIdentity.Username,
				Action:       "process.kill",
				ResourceType: "process",
				ResourceName: strconv.Itoa(pid),
				Status:       "failure",
				Details:      request.Signal + ": " + err.Error(),
			},
		)

		writeManagementAgentError(
			w,
			err,
		)

		return
	}

	recordManagementAudit(
		r,
		auditStore,
		audit.Event{
			Username:     currentIdentity.Username,
			Action:       "process.kill",
			ResourceType: "process",
			ResourceName: strconv.Itoa(pid),
			Status:       "success",
			Details:      "process signaled with " + request.Signal,
		},
	)

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

func isServiceAction(action string) bool {
	switch action {
	case "start",
		"stop",
		"restart",
		"enable",
		"disable":
		return true

	default:
		return false
	}
}

func recordManagementAudit(
	r *http.Request,
	store *audit.Store,
	event audit.Event,
) {
	if store == nil {
		return
	}

	event.IPAddress = clientIPAddress(r)
	event.UserAgent = r.UserAgent()

	if err := store.Record(
		r.Context(),
		event,
	); err != nil {
		log.Printf(
			"management audit record failed: action=%s error=%v",
			event.Action,
			err,
		)
	}
}

func writeManagementAgentError(
	w http.ResponseWriter,
	err error,
) {
	status := http.StatusBadGateway

	var agentErr *agent.AgentHTTPError

	if errors.As(err, &agentErr) {
		switch agentErr.StatusCode {
		case http.StatusBadRequest,
			http.StatusNotFound,
			http.StatusConflict:

			status = agentErr.StatusCode
		}
	}

	writeJSON(
		w,
		status,
		map[string]any{
			"success": false,
			"error":   err.Error(),
		},
	)
}
