package tmux

import (
	"bytes"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

type Session struct {
	Name     string `json:"name"`
	Windows  int    `json:"windows"`
	Attached bool   `json:"attached"`
}

func ListSessions() ([]Session, error) {
	cmd := exec.Command(
		"tmux",
		"list-sessions",
		"-F",
		"#{session_name}\t#{session_windows}\t#{session_attached}",
	)

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		// tmux returns an error when there is no server.
		if strings.Contains(stderr.String(), "no server running") ||
			strings.Contains(stderr.String(), "No such file or directory") {
			return []Session{}, nil
		}

		return nil, fmt.Errorf(
			"tmux list-sessions: %w: %s",
			err,
			stderr.String(),
		)
	}

	var sessions []Session

	for _, line := range strings.Split(
		strings.TrimSpace(stdout.String()),
		"\n",
	) {
		if line == "" {
			continue
		}

		parts := strings.Split(line, "\t")
		if len(parts) != 3 {
			continue
		}

		windows, err := strconv.Atoi(parts[1])
		if err != nil {
			continue
		}

		attached := parts[2] == "1"

		sessions = append(sessions, Session{
			Name:     parts[0],
			Windows:  windows,
			Attached: attached,
		})
	}

	return sessions, nil
}

func HasSession(name string) bool {
	if name == "" {
		return false
	}

	sessions, err := ListSessions()
	if err != nil {
		return false
	}

	for _, session := range sessions {
		if session.Name == name {
			return true
		}
	}

	return false
}
