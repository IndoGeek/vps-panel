package agent

import (
	"fmt"
	"io"
	"net/http"
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
