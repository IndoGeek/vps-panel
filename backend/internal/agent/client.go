package agent

import (
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
)

type Client struct {
	BaseURL string
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
	}
}

func (c *Client) Snapshot() ([]byte, error) {
	resp, err := http.Get(c.BaseURL + "/api/v1/snapshot")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent returned status %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func (c *Client) ConnectTmuxSession(
	session string,
) (*websocket.Conn, error) {
	parsed, err := url.Parse(c.BaseURL)
	if err != nil {
		return nil, err
	}

	parsed.Scheme = "ws"
	parsed.Path = "/api/v1/tmux/connect"

	query := parsed.Query()
	query.Set("name", session)
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
