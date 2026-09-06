package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type ManagedService struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Active      bool   `json:"active"`
	Enabled     bool   `json:"enabled"`
}

type ManagedProcess struct {
	PID           int     `json:"pid"`
	PPID          int     `json:"ppid"`
	UID           int     `json:"uid"`
	User          string  `json:"user"`
	State         string  `json:"state"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	MemoryBytes   uint64  `json:"memory_bytes"`
	Command       string  `json:"command"`
}

type managementServicesResponse struct {
	Services []ManagedService `json:"services"`
}

type managementProcessesResponse struct {
	Processes []ManagedProcess `json:"processes"`
}

type AgentHTTPError struct {
	StatusCode int
	Message    string
}

func (e *AgentHTTPError) Error() string {
	if e.Message == "" {
		return fmt.Sprintf(
			"agent returned status %d",
			e.StatusCode,
		)
	}

	return fmt.Sprintf(
		"agent returned status %d: %s",
		e.StatusCode,
		e.Message,
	)
}

func (c *Client) ListServices() (
	[]ManagedService,
	error,
) {
	var result managementServicesResponse

	if err := c.managementJSON(
		http.MethodGet,
		"/api/v1/services",
		nil,
		&result,
	); err != nil {
		return nil, err
	}

	return result.Services, nil
}

func (c *Client) ManageService(
	name string,
	action string,
) error {
	path :=
		"/api/v1/services/" +
			url.PathEscape(name) +
			"/" +
			url.PathEscape(action)

	return c.managementJSON(
		http.MethodPost,
		path,
		nil,
		nil,
	)
}

func (c *Client) ListProcesses() (
	[]ManagedProcess,
	error,
) {
	var result managementProcessesResponse

	if err := c.managementJSON(
		http.MethodGet,
		"/api/v1/processes",
		nil,
		&result,
	); err != nil {
		return nil, err
	}

	return result.Processes, nil
}

func (c *Client) KillProcess(
	pid int,
	signal string,
) error {
	body := struct {
		Signal string `json:"signal"`
	}{
		Signal: signal,
	}

	path :=
		"/api/v1/processes/" +
			strconv.Itoa(pid) +
			"/kill"

	return c.managementJSON(
		http.MethodPost,
		path,
		body,
		nil,
	)
}

func (c *Client) managementJSON(
	method string,
	path string,
	body any,
	result any,
) error {
	var requestBody io.Reader

	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}

		requestBody = bytes.NewReader(data)
	}

	request, err := http.NewRequest(
		method,
		c.BaseURL+path,
		requestBody,
	)
	if err != nil {
		return err
	}

	request.Header.Set(
		"Accept",
		"application/json",
	)

	if body != nil {
		request.Header.Set(
			"Content-Type",
			"application/json",
		)
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}

	defer response.Body.Close()

	responseBody, err := io.ReadAll(
		response.Body,
	)
	if err != nil {
		return err
	}

	if response.StatusCode < 200 ||
		response.StatusCode >= 300 {
		return &AgentHTTPError{
			StatusCode: response.StatusCode,
			Message: strings.TrimSpace(
				string(responseBody),
			),
		}
	}

	if result == nil ||
		len(responseBody) == 0 {
		return nil
	}

	return json.Unmarshal(
		responseBody,
		result,
	)
}
