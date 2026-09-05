package main

import (
	"fmt"
	"log"

	"github.com/tanmay/vps-panel/agent/internal/identity"
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
}
