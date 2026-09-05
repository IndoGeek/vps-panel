package tmux

import (
	"fmt"
	"os/exec"
)

func AttachCommand(session string) (*exec.Cmd, error) {
	if session == "" {
		return nil, fmt.Errorf("session name is required")
	}

	return exec.Command(
		"tmux",
		"attach-session",
		"-t",
		session,
	), nil
}
