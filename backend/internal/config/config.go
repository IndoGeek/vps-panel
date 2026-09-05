package config

import "os"

type Config struct {
	Host string
	Port string

	AuthUsername     string
	AuthPasswordHash string
	AuthLinuxUser    string
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

	return Config{
		Host:             host,
		Port:             port,
		AuthUsername:     os.Getenv("VPS_PANEL_AUTH_USERNAME"),
		AuthPasswordHash: os.Getenv("VPS_PANEL_AUTH_PASSWORD_HASH"),
		AuthLinuxUser:    os.Getenv("VPS_PANEL_AUTH_LINUX_USER"),
	}
}
