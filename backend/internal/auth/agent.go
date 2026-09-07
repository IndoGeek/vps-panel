package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type AgentVerifier struct {
	URL   string
	Token string

	Client *http.Client
}

type agentVerifyRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type agentVerifyResponse struct {
	Authenticated bool   `json:"authenticated"`
	Sudo          bool   `json:"sudo"`
	Username      string `json:"username"`
	LinuxUser     string `json:"linux_user"`
}

func NewAgentVerifier(
	url string,
	token string,
) *AgentVerifier {
	return &AgentVerifier{
		URL: strings.TrimRight(
			url,
			"/",
		),

		Token: token,

		Client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (v *AgentVerifier) Verify(
	username string,
	password string,
) (Verification, error) {
	if v == nil ||
		v.URL == "" ||
		v.Token == "" {
		return Verification{}, ErrVerifierUnavailable
	}

	payload := agentVerifyRequest{
		Username: username,
		Password: password,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return Verification{}, err
	}

	request, err := http.NewRequest(
		http.MethodPost,
		v.URL+"/api/v1/auth/verify",
		bytes.NewReader(data),
	)
	if err != nil {
		return Verification{}, err
	}

	request.Header.Set(
		"Content-Type",
		"application/json",
	)

	request.Header.Set(
		"Accept",
		"application/json",
	)

	request.Header.Set(
		"X-VPS-Panel-Auth-Token",
		v.Token,
	)

	response, err := v.Client.Do(request)
	if err != nil {
		return Verification{}, err
	}

	defer response.Body.Close()

	body, err := io.ReadAll(
		response.Body,
	)
	if err != nil {
		return Verification{}, err
	}

	if response.StatusCode == http.StatusUnauthorized {
		return Verification{
			Authenticated: false,
		}, nil
	}

	if response.StatusCode < 200 ||
		response.StatusCode >= 300 {
		return Verification{}, fmt.Errorf(
			"authentication agent returned %s: %s",
			response.Status,
			strings.TrimSpace(string(body)),
		)
	}

	var result agentVerifyResponse

	if err := json.Unmarshal(
		body,
		&result,
	); err != nil {
		return Verification{}, err
	}

	return Verification{
		Authenticated: result.Authenticated,
		Sudo:          result.Sudo,
		LinuxUser:     result.LinuxUser,
	}, nil
}
