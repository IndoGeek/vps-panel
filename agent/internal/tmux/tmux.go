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
		stderrText := stderr.String()

		// tmux returns an error when there is no server.
		if strings.Contains(stderrText, "no server running") ||
			strings.Contains(stderrText, "No such file or directory") {
			return []Session{}, nil
		}

		return nil, fmt.Errorf(
			"tmux list-sessions: %w: %s",
			err,
			stderrText,
		)
	}

	output := strings.TrimSpace(stdout.String())

	if output == "" {
		return []Session{}, nil
	}

	sessions := make([]Session, 0)

	for _, line := range strings.Split(output, "\n") {
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

		sessions = append(
			sessions,
			Session{
				Name:     parts[0],
				Windows:  windows,
				Attached: attached,
			},
		)
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

func validateSessionName(name string) error {
	name = strings.TrimSpace(name)

	if name == "" {
		return fmt.Errorf("session name is required")
	}

	if len(name) > 64 {
		return fmt.Errorf("session name must not exceed 64 characters")
	}

	for _, character := range name {
		if (character >= 'a' && character <= 'z') ||
			(character >= 'A' && character <= 'Z') ||
			(character >= '0' && character <= '9') ||
			character == '-' ||
			character == '_' ||
			character == '.' {
			continue
		}

		return fmt.Errorf(
			"session name may contain only letters, numbers, hyphens, underscores, and dots",
		)
	}

	return nil
}

func CreateSession(name string) error {
	if err := validateSessionName(name); err != nil {
		return err
	}

	if HasSession(name) {
		return fmt.Errorf(
			"tmux session %q already exists",
			name,
		)
	}

	cmd := exec.Command(
		"tmux",
		"new-session",
		"-d",
		"-s",
		name,
	)

	var stderr bytes.Buffer

	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())

		if message == "" {
			return fmt.Errorf(
				"tmux create session: %w",
				err,
			)
		}

		return fmt.Errorf(
			"tmux create session: %w: %s",
			err,
			message,
		)
	}

	return nil
}

func RenameSession(
	currentName string,
	newName string,
) error {
	if err := validateSessionName(currentName); err != nil {
		return err
	}

	if err := validateSessionName(newName); err != nil {
		return fmt.Errorf(
			"invalid new session name: %w",
			err,
		)
	}

	if currentName == newName {
		return fmt.Errorf(
			"new session name is the same as the current name",
		)
	}

	if !HasSession(currentName) {
		return fmt.Errorf(
			"tmux session %q not found",
			currentName,
		)
	}

	if HasSession(newName) {
		return fmt.Errorf(
			"tmux session %q already exists",
			newName,
		)
	}

	cmd := exec.Command(
		"tmux",
		"rename-session",
		"-t",
		currentName,
		newName,
	)

	var stderr bytes.Buffer

	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())

		if message == "" {
			return fmt.Errorf(
				"tmux rename session: %w",
				err,
			)
		}

		return fmt.Errorf(
			"tmux rename session: %w: %s",
			err,
			message,
		)
	}

	return nil
}

func DetachSession(name string) error {
	if err := validateSessionName(name); err != nil {
		return err
	}

	if !HasSession(name) {
		return fmt.Errorf(
			"tmux session %q not found",
			name,
		)
	}

	cmd := exec.Command(
		"tmux",
		"detach-client",
		"-s",
		name,
	)

	var stderr bytes.Buffer

	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())

		/*
			There may be no clients attached.

			This is not considered a fatal error because
			the desired final state is simply "detached".
		*/
		if strings.Contains(
			strings.ToLower(message),
			"no client",
		) {
			return nil
		}

		if message == "" {
			return fmt.Errorf(
				"tmux detach session: %w",
				err,
			)
		}

		return fmt.Errorf(
			"tmux detach session: %w: %s",
			err,
			message,
		)
	}

	return nil
}

func DeleteSession(name string) error {
	if err := validateSessionName(name); err != nil {
		return err
	}

	if !HasSession(name) {
		return fmt.Errorf(
			"tmux session %q not found",
			name,
		)
	}

	cmd := exec.Command(
		"tmux",
		"kill-session",
		"-t",
		name,
	)

	var stderr bytes.Buffer

	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())

		if message == "" {
			return fmt.Errorf(
				"tmux delete session: %w",
				err,
			)
		}

		return fmt.Errorf(
			"tmux delete session: %w: %s",
			err,
			message,
		)
	}

	return nil
}
