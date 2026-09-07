package authapi

import (
	"crypto/subtle"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/tanmay/vps-panel/agent/internal/authverify"
)

type Server struct {
	addr  string
	token string
}

func NewServer(
	addr string,
	token string,
) *Server {
	return &Server{
		addr:  addr,
		token: token,
	}
}

func (s *Server) ListenAndServe() error {
	if strings.TrimSpace(s.token) == "" {
		return &configurationError{
			message: "VPS_PANEL_AGENT_AUTH_TOKEN is not configured",
		}
	}

	mux := http.NewServeMux()

	mux.HandleFunc(
		"/api/v1/auth/verify",
		s.handleVerify,
	)

	log.Printf(
		"VPS Panel authentication agent starting on %s",
		s.addr,
	)

	return http.ListenAndServe(
		s.addr,
		mux,
	)
}

func (s *Server) handleVerify(
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

	token := r.Header.Get(
		"X-VPS-Panel-Auth-Token",
	)

	if !secureEqual(
		token,
		s.token,
	) {
		http.Error(
			w,
			"unauthorized",
			http.StatusUnauthorized,
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

	result, err := authverify.Verify(
		request.Username,
		request.Password,
	)
	if err != nil {
		log.Printf(
			"PAM verification failed internally: %v",
			err,
		)

		http.Error(
			w,
			"authentication service unavailable",
			http.StatusInternalServerError,
		)

		return
	}

	writeJSON(
		w,
		http.StatusOK,
		map[string]any{
			"authenticated": result.Authenticated,
			"sudo":          result.Sudo,
			"username":      result.Username,
			"linux_user":    result.LinuxUser,
		},
	)
}

func secureEqual(
	left string,
	right string,
) bool {
	if left == "" ||
		right == "" {
		return false
	}

	if len(left) != len(right) {
		return false
	}

	return subtle.ConstantTimeCompare(
		[]byte(left),
		[]byte(right),
	) == 1
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

type configurationError struct {
	message string
}

func (e *configurationError) Error() string {
	return e.message
}
