package config

import "os"

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
