package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/tanmay/vps-panel/backend/internal/config"
	api "github.com/tanmay/vps-panel/backend/internal/http"
)

func main() {
	cfg := config.Load()

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)

	router := api.NewRouter()

	server := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	log.Printf("VPS Panel backend starting on %s", addr)

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
