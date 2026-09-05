package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/tanmay/vps-panel/backend/internal/auth"
	"github.com/tanmay/vps-panel/backend/internal/config"
	api "github.com/tanmay/vps-panel/backend/internal/http"
)

func main() {
	cfg := config.Load()

	authService, err := auth.New(auth.Config{
		Username:     cfg.AuthUsername,
		PasswordHash: cfg.AuthPasswordHash,
		LinuxUser:    cfg.AuthLinuxUser,
		CookieName:   "vps_panel_session",
		SessionTTL:   12 * time.Hour,
	})
	if err != nil {
		log.Fatalf("authentication initialization failed: %v", err)
	}

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)

	router := api.NewRouter(authService)

	server := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	log.Printf("VPS Panel backend starting on %s", addr)

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
