package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

const schema = `
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    username VARCHAR(191) NOT NULL DEFAULT '',
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL DEFAULT '',
    resource_name VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL,
    ip_address VARCHAR(45) NOT NULL DEFAULT '',
    user_agent VARCHAR(512) NOT NULL DEFAULT '',
    details TEXT NOT NULL,

    PRIMARY KEY (id),

    KEY idx_audit_created_at (created_at),
    KEY idx_audit_action (action),
    KEY idx_audit_status (status),
    KEY idx_audit_username (username)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
`

func Open(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("database DSN is not configured")
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()

		return nil, fmt.Errorf(
			"database ping failed: %w",
			err,
		)
	}

	if _, err := db.ExecContext(
		ctx,
		schema,
	); err != nil {
		_ = db.Close()

		return nil, fmt.Errorf(
			"database schema initialization failed: %w",
			err,
		)
	}

	return db, nil
}
