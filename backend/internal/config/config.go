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

	AuthUsername     string
	AuthPasswordHash string
	AuthLinuxUser    string

	DatabaseDSN string
	AgentURL    string
}

func Load() Config {
	loadDotEnv()

	host := os.Getenv("VPS_PANEL_HOST")

	if host == "" {
		host = "127.0.0.1"
	}

	port := os.Getenv("VPS_PANEL_PORT")

	if port == "" {
		port = "8090"
	}

	agentURL := os.Getenv("VPS_PANEL_AGENT_URL")

	if agentURL == "" {
		agentURL = "http://127.0.0.1:8091"
	}

	return Config{
		Host: host,
		Port: port,

		AuthUsername:     os.Getenv("VPS_PANEL_AUTH_USERNAME"),
		AuthPasswordHash: os.Getenv("VPS_PANEL_AUTH_PASSWORD_HASH"),
		AuthLinuxUser:    os.Getenv("VPS_PANEL_AUTH_LINUX_USER"),

		DatabaseDSN: os.Getenv("VPS_PANEL_DB_DSN"),
		AgentURL:    agentURL,
	}
}

/*
loadDotEnv loads the project .env file.

The loader intentionally does NOT overwrite environment
variables that already exist.

This allows the same application to work with:

- a local root .env
- shell environment variables
- systemd EnvironmentFile
- container environment variables

The project .env is normally located at:

vps-panel/.env
*/
func loadDotEnv() {
	envPath := os.Getenv("VPS_PANEL_ENV_FILE")

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

		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}

		parent := filepath.Dir(currentDir)

		if parent == currentDir {
			break
		}

		currentDir = parent
	}

	return ""
}

func loadEnvFile(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}

	defer file.Close()

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "#") {
			continue
		}

		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(
				strings.TrimPrefix(line, "export "),
			)
		}

		separator := strings.IndexByte(line, '=')

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

		/*
			Do not overwrite values already supplied
			by the shell/system/container.
		*/
		if _, exists := os.LookupEnv(key); exists {
			continue
		}

		_ = os.Setenv(key, value)
	}
}

func parseEnvValue(value string) string {
	if len(value) < 2 {
		return value
	}

	/*
		Double quoted values.

		This also allows escaped characters such as:
		\" and \\.
	*/
	if strings.HasPrefix(value, `"`) &&
		strings.HasSuffix(value, `"`) {
		unquoted, err := strconv.Unquote(value)

		if err == nil {
			return unquoted
		}

		return value[1 : len(value)-1]
	}

	/*
		Single quoted values.

		.env files commonly use single quotes for
		passwords and other values containing special
		characters.
	*/
	if strings.HasPrefix(value, "'") &&
		strings.HasSuffix(value, "'") {
		return value[1 : len(value)-1]
	}

	return value
}
