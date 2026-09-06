package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/tanmay/vps-panel/backend/internal/audit"
	"github.com/tanmay/vps-panel/backend/internal/auth"
	"github.com/tanmay/vps-panel/backend/internal/config"
	"github.com/tanmay/vps-panel/backend/internal/database"
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
		log.Fatalf(
			"authentication initialization failed: %v",
			err,
		)
	}

	db, err := database.Open(
		cfg.DatabaseDSN,
	)
	if err != nil {
		log.Fatalf(
			"database initialization failed: %v",
			err,
		)
	}

	defer db.Close()

	auditStore := audit.NewStore(db)

	addr := fmt.Sprintf(
		"%s:%s",
		cfg.Host,
		cfg.Port,
	)

	router := api.NewRouterWithSystem(
		authService,
		auditStore,
		cfg.AgentURL,
	)

	server := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	log.Printf(
		"VPS Panel backend starting on %s",
		addr,
	)

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
