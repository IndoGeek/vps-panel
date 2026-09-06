package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/websocket"
)

type Client struct {
	BaseURL string
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(
			baseURL,
			"/",
		),
	}
}

func (c *Client) Snapshot() ([]byte, error) {
	resp, err := http.Get(
		c.BaseURL + "/api/v1/snapshot",
	)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(
			"agent returned status %s",
			resp.Status,
		)
	}

	body, err := io.ReadAll(
		resp.Body,
	)
	if err != nil {
		return nil, err
	}

	return body, nil
}

type TmuxSession struct {
	Name     string `json:"name"`
	Windows  int    `json:"windows"`
	Attached bool   `json:"attached"`
}

type tmuxSessionsResponse struct {
	Sessions []TmuxSession `json:"sessions"`
}

type tmuxSessionActionResponse struct {
	Session  string `json:"session"`
	Previous string `json:"previous,omitempty"`
	Success  bool   `json:"success"`
	Action   string `json:"action,omitempty"`
}

func (c *Client) ListTmuxSessions() (
	[]TmuxSession,
	error,
) {
	resp, err := http.Get(
		c.BaseURL + "/api/v1/tmux/session",
	)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)

		message := strings.TrimSpace(
			string(body),
		)

		if message != "" {
			return nil, fmt.Errorf(
				"agent returned status %s: %s",
				resp.Status,
				message,
			)
		}

		return nil, fmt.Errorf(
			"agent returned status %s",
			resp.Status,
		)
	}

	var result tmuxSessionsResponse

	if err := json.NewDecoder(
		resp.Body,
	).Decode(&result); err != nil {
		return nil, err
	}

	return result.Sessions, nil
}

func (c *Client) CreateTmuxSession(
	name string,
) error {
	request := struct {
		Name string `json:"name"`
	}{
		Name: name,
	}

	return c.doTmuxJSON(
		http.MethodPost,
		"/api/v1/tmux/session",
		"",
		request,
	)
}

func (c *Client) RenameTmuxSession(
	currentName string,
	newName string,
) error {
	request := struct {
		Name string `json:"name"`
	}{
		Name: newName,
	}

	return c.doTmuxJSON(
		http.MethodPatch,
		"/api/v1/tmux/session",
		currentName,
		request,
	)
}

func (c *Client) DetachTmuxSession(
	name string,
) error {
	return c.doTmuxJSON(
		http.MethodPost,
		"/api/v1/tmux/session",
		name,
		nil,
	)
}

func (c *Client) DeleteTmuxSession(
	name string,
) error {
	return c.doTmuxJSON(
		http.MethodDelete,
		"/api/v1/tmux/session",
		name,
		nil,
	)
}

func (c *Client) doTmuxJSON(
	method string,
	path string,
	session string,
	body any,
) error {
	var requestBody io.Reader

	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}

		requestBody = bytes.NewReader(data)
	}

	parsed, err := url.Parse(
		c.BaseURL + path,
	)
	if err != nil {
		return err
	}

	query := parsed.Query()

	if session != "" {
		query.Set(
			"name",
			session,
		)
	}

	/*
		POSTing to an existing session with no JSON body
		is our detach operation.
	*/
	if method == http.MethodPost &&
		body == nil &&
		session != "" {
		query.Set(
			"action",
			"detach",
		)
	}

	parsed.RawQuery = query.Encode()

	req, err := http.NewRequest(
		method,
		parsed.String(),
		requestBody,
	)
	if err != nil {
		return err
	}

	if body != nil {
		req.Header.Set(
			"Content-Type",
			"application/json",
		)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode < 200 ||
		resp.StatusCode >= 300 {

		responseBody, _ := io.ReadAll(
			resp.Body,
		)

		message := strings.TrimSpace(
			string(responseBody),
		)

		if message != "" {
			return fmt.Errorf(
				"agent returned status %s: %s",
				resp.Status,
				message,
			)
		}

		return fmt.Errorf(
			"agent returned status %s",
			resp.Status,
		)
	}

	return nil
}

func (c *Client) ConnectTmuxSession(
	session string,
) (*websocket.Conn, error) {
	parsed, err := url.Parse(
		c.BaseURL,
	)
	if err != nil {
		return nil, err
	}

	parsed.Scheme = "ws"
	parsed.Path = "/api/v1/tmux/connect"

	query := parsed.Query()

	query.Set(
		"name",
		session,
	)

	parsed.RawQuery = query.Encode()

	conn, _, err := websocket.DefaultDialer.Dial(
		parsed.String(),
		nil,
	)
	if err != nil {
		return nil, err
	}

	return conn, nil
}
