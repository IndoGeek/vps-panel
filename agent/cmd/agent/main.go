package main

import (
	"fmt"
	"os/user"
)

func main() {
	currentUser, err := user.Current()
	if err != nil {
		panic(err)
	}

	fmt.Println("VPS Panel Agent")
	fmt.Println("----------------")
	fmt.Printf("Username: %s\n", currentUser.Username)
	fmt.Printf("UID:      %s\n", currentUser.Uid)
	fmt.Printf("GID:      %s\n", currentUser.Gid)
	fmt.Printf("Home:     %s\n", currentUser.HomeDir)
}
