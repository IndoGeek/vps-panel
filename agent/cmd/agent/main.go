package main

import (
	"log"

	httpapi "github.com/tanmay/vps-panel/agent/internal/http"
)

func main() {
	server := httpapi.NewServer(
		"127.0.0.1:8091",
	)

	if err := server.ListenAndServeWithSystem(); err != nil {
		log.Fatal(err)
	}
}
