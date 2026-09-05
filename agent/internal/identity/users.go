package identity

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

type User struct {
	Username string `json:"username"`
	UID      int    `json:"uid"`
	GID      int    `json:"gid"`
	HomeDir  string `json:"home_dir"`
	Shell    string `json:"shell"`
}

func ListInteractiveUsers() ([]User, error) {
	file, err := os.Open("/etc/passwd")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var users []User

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.Split(line, ":")
		if len(parts) != 7 {
			continue
		}

		username := parts[0]

		uid, err := strconv.Atoi(parts[2])
		if err != nil {
			continue
		}

		gid, err := strconv.Atoi(parts[3])
		if err != nil {
			continue
		}

		homeDir := parts[5]
		shell := parts[6]

		// Ignore system/service accounts.
		if uid < 1000 {
			continue
		}

		// Ignore accounts that cannot normally log in.
		if shell == "/usr/sbin/nologin" ||
			shell == "/usr/bin/nologin" ||
			shell == "/bin/false" ||
			shell == "/usr/bin/false" {
			continue
		}

		users = append(users, User{
			Username: username,
			UID:      uid,
			GID:      gid,
			HomeDir:  homeDir,
			Shell:    shell,
		})
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return users, nil
}
