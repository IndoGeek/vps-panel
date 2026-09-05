package main

import (
	"fmt"
	"log"

	"github.com/tanmay/vps-panel/agent/internal/identity"
	"github.com/tanmay/vps-panel/agent/internal/tmux"
)

func main() {
	fmt.Println("VPS Panel Agent")
	fmt.Println("================")
	fmt.Println()

	users, err := identity.ListInteractiveUsers()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Interactive Linux Users")
	fmt.Println("-----------------------")

	for _, user := range users {
		fmt.Printf(
			"%-12s UID=%-6d GID=%-6d HOME=%-25s SHELL=%s\n",
			user.Username,
			user.UID,
			user.GID,
			user.HomeDir,
			user.Shell,
		)
	}

	fmt.Println()
	fmt.Println("Current User's tmux Sessions")
	fmt.Println("----------------------------")

	sessions, err := tmux.ListSessions()
	if err != nil {
		log.Fatal(err)
	}

	if len(sessions) == 0 {
		fmt.Println("No tmux sessions running.")
		return
	}

	for _, session := range sessions {
		fmt.Printf(
			"%-20s windows=%-3d attached=%v\n",
			session.Name,
			session.Windows,
			session.Attached,
		)
	}
}
