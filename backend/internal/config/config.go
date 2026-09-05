package config

import "os"

type Config struct {
	Host string
	Port string
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
		Host: host,
		Port: port,
	}
}
