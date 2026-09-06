package http

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/tanmay/vps-panel/backend/internal/audit"
	"github.com/tanmay/vps-panel/backend/internal/auth"
)

func NewRouterWithSystem(
	authService *auth.Service,
	auditStore *audit.Store,
	agentURL string,
) http.Handler {
	baseRouter := NewRouter(
		authService,
		auditStore,
		agentURL,
	)

	/*
		Management is placed behind the authenticated backend
		before the system-power wrapper.
	*/

	managementRouter := managementWrapper(
		baseRouter,
		authService,
		auditStore,
		agentURL,
	)

	return systemPowerWrapper(
		managementRouter,
		authService,
		auditStore,
		agentURL,
	)
}

func systemPowerWrapper(
	next http.Handler,
	authService *auth.Service,
	auditStore *audit.Store,
	agentURL string,
) http.Handler {
	return http.HandlerFunc(func(
		w http.ResponseWriter,
		r *http.Request,
	) {
		switch r.URL.Path {
		case "/api/v1/system/reboot":
			handleSystemPower(
				w,
				r,
				authService,
				auditStore,
				agentURL,
				"reboot",
			)

		case "/api/v1/system/shutdown":
			handleSystemPower(
				w,
				r,
				authService,
				auditStore,
				agentURL,
				"shutdown",
			)

		default:
			next.ServeHTTP(w, r)
		}
	})
}

func handleSystemPower(
	w http.ResponseWriter,
	r *http.Request,
	authService *auth.Service,
	auditStore *audit.Store,
	agentURL string,
	action string,
) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	currentIdentity, authenticated := authService.Current(r)

	if !authenticated {
		http.Error(
			w,
			"unauthorized",
			http.StatusUnauthorized,
		)

		return
	}

	if action != "reboot" &&
		action != "shutdown" {
		http.Error(
			w,
			"invalid system action",
			http.StatusBadRequest,
		)

		return
	}

	err := requestAgentPower(
		agentURL,
		action,
	)
	if err != nil {
		_ = auditStore.Record(
			r.Context(),
			audit.Event{
				Username:     currentIdentity.Username,
				Action:       "system." + action,
				ResourceType: "system",
				ResourceName: action,
				Status:       "failure",
				IPAddress:    clientIPAddress(r),
				UserAgent:    r.UserAgent(),
				Details:      err.Error(),
			},
		)

		writeSystemJSON(
			w,
			http.StatusBadGateway,
			map[string]any{
				"success": false,
				"action":  action,
				"error":   "agent unavailable: " + err.Error(),
			},
		)

		return
	}

	_ = auditStore.Record(
		r.Context(),
		audit.Event{
			Username:     currentIdentity.Username,
			Action:       "system." + action,
			ResourceType: "system",
			ResourceName: action,
			Status:       "success",
			IPAddress:    clientIPAddress(r),
			UserAgent:    r.UserAgent(),
			Details:      "system " + action + " requested",
		},
	)

	writeSystemJSON(
		w,
		http.StatusAccepted,
		map[string]any{
			"success":  true,
			"action":   action,
			"accepted": true,
		},
	)
}

func requestAgentPower(
	agentURL string,
	action string,
) error {
	baseURL := strings.TrimRight(
		agentURL,
		"/",
	)

	url := baseURL +
		"/api/v1/system/" +
		action

	request, err := http.NewRequest(
		http.MethodPost,
		url,
		nil,
	)
	if err != nil {
		return err
	}

	request.Header.Set(
		"Accept",
		"application/json",
	)

	response, err := http.DefaultClient.Do(
		request,
	)
	if err != nil {
		return err
	}

	defer response.Body.Close()

	if response.StatusCode < 200 ||
		response.StatusCode >= 300 {

		body, _ := io.ReadAll(
			response.Body,
		)

		message := strings.TrimSpace(
			string(body),
		)

		if message == "" {
			message = response.Status
		}

		return fmt.Errorf(
			"agent returned %s: %s",
			response.Status,
			message,
		)
	}

	return nil
}

func writeSystemJSON(
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
