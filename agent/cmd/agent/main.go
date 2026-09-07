package main

import (
	"bufio"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	authapi "github.com/tanmay/vps-panel/agent/internal/authapi"
	httpapi "github.com/tanmay/vps-panel/agent/internal/http"
)

func main() {
	loadDotEnv()

	token := os.Getenv(
		"VPS_PANEL_AGENT_AUTH_TOKEN",
	)

	authServer := authapi.NewServer(
		"127.0.0.1:8092",
		token,
	)

	go func() {
		if err := authServer.ListenAndServe(); err != nil {
			log.Fatal(err)
		}
	}()

	server := httpapi.NewServer(
		"127.0.0.1:8091",
	)

	if err := server.ListenAndServeWithSystem(); err != nil {
		log.Fatal(err)
	}
}

func loadDotEnv() {
	path := findProjectEnv()

	if path == "" {
		return
	}

	file, err := os.Open(path)
	if err != nil {
		return
	}

	defer file.Close()

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := strings.TrimSpace(
			scanner.Text(),
		)

		if line == "" ||
			strings.HasPrefix(line, "#") {
			continue
		}

		if strings.HasPrefix(
			line,
			"export ",
		) {
			line = strings.TrimSpace(
				strings.TrimPrefix(
					line,
					"export ",
				),
			)
		}

		index := strings.IndexByte(
			line,
			'=',
		)

		if index <= 0 {
			continue
		}

		key := strings.TrimSpace(
			line[:index],
		)

		value := strings.TrimSpace(
			line[index+1:],
		)

		if key == "" {
			continue
		}

		value = parseEnvValue(value)

		if _, exists := os.LookupEnv(key); exists {
			continue
		}

		_ = os.Setenv(
			key,
			value,
		)
	}
}

func findProjectEnv() string {
	current, err := os.Getwd()
	if err != nil {
		return ""
	}

	for {
		path := filepath.Join(
			current,
			".env",
		)

		if info, err := os.Stat(path); err == nil &&
			!info.IsDir() {
			return path
		}

		parent := filepath.Dir(current)

		if parent == current {
			return ""
		}

		current = parent
	}
}

func parseEnvValue(
	value string,
) string {
	if len(value) >= 2 {
		if strings.HasPrefix(value, "'") &&
			strings.HasSuffix(value, "'") {
			return value[1 : len(value)-1]
		}

		if strings.HasPrefix(value, `"`) &&
			strings.HasSuffix(value, `"`) {
			if unquoted, err := strconv.Unquote(value); err == nil {
				return unquoted
			}

			return value[1 : len(value)-1]
		}
	}

	return value
}
