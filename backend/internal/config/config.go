package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	Host string
	Port string

	DatabaseDSN string

	AgentURL string

	AuthAgentURL   string
	AgentAuthToken string
}

func Load() Config {
	loadDotEnv()

	host := os.Getenv(
		"VPS_PANEL_HOST",
	)

	if host == "" {
		host = "127.0.0.1"
	}

	port := os.Getenv(
		"VPS_PANEL_PORT",
	)

	if port == "" {
		port = "8090"
	}

	agentURL := os.Getenv(
		"VPS_PANEL_AGENT_URL",
	)

	if agentURL == "" {
		agentURL = "http://127.0.0.1:8091"
	}

	authAgentURL := os.Getenv(
		"VPS_PANEL_AUTH_AGENT_URL",
	)

	if authAgentURL == "" {
		authAgentURL = "http://127.0.0.1:8092"
	}

	return Config{
		Host: host,
		Port: port,

		DatabaseDSN: os.Getenv(
			"VPS_PANEL_DB_DSN",
		),

		AgentURL: agentURL,

		AuthAgentURL: authAgentURL,

		AgentAuthToken: os.Getenv(
			"VPS_PANEL_AGENT_AUTH_TOKEN",
		),
	}
}

func loadDotEnv() {
	envPath := os.Getenv(
		"VPS_PANEL_ENV_FILE",
	)

	if envPath != "" {
		loadEnvFile(envPath)
		return
	}

	envPath = findProjectEnvFile()

	if envPath == "" {
		return
	}

	loadEnvFile(envPath)
}

func findProjectEnvFile() string {
	currentDir, err := os.Getwd()
	if err != nil {
		return ""
	}

	for {
		candidate := filepath.Join(
			currentDir,
			".env",
		)

		if info, err := os.Stat(candidate); err == nil &&
			!info.IsDir() {
			return candidate
		}

		parent := filepath.Dir(
			currentDir,
		)

		if parent == currentDir {
			break
		}

		currentDir = parent
	}

	return ""
}

func loadEnvFile(
	path string,
) {
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

		separator := strings.IndexByte(
			line,
			'=',
		)

		if separator <= 0 {
			continue
		}

		key := strings.TrimSpace(
			line[:separator],
		)

		value := strings.TrimSpace(
			line[separator+1:],
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

func parseEnvValue(
	value string,
) string {
	if len(value) < 2 {
		return value
	}

	if strings.HasPrefix(value, `"`) &&
		strings.HasSuffix(value, `"`) {
		unquoted, err := strconv.Unquote(
			value,
		)

		if err == nil {
			return unquoted
		}

		return value[1 : len(value)-1]
	}

	if strings.HasPrefix(value, "'") &&
		strings.HasSuffix(value, "'") {
		return value[1 : len(value)-1]
	}

	return value
}
