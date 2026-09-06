package audit

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Event struct {
	Username     string
	Action       string
	ResourceType string
	ResourceName string
	Status       string
	IPAddress    string
	UserAgent    string
	Details      string
}

type Entry struct {
	ID           int64     `json:"id"`
	CreatedAt    time.Time `json:"created_at"`
	Username     string    `json:"username"`
	Action       string    `json:"action"`
	ResourceType string    `json:"resource_type"`
	ResourceName string    `json:"resource_name"`
	Status       string    `json:"status"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	Details      string    `json:"details"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{
		db: db,
	}
}

func (s *Store) Record(
	ctx context.Context,
	event Event,
) error {
	if s == nil || s.db == nil {
		return fmt.Errorf(
			"audit store is not initialized",
		)
	}

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO audit_logs
			(
				username,
				action,
				resource_type,
				resource_name,
				status,
				ip_address,
				user_agent,
				details
			)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		event.Username,
		event.Action,
		event.ResourceType,
		event.ResourceName,
		event.Status,
		event.IPAddress,
		event.UserAgent,
		event.Details,
	)

	return err
}

func (s *Store) List(
	ctx context.Context,
	limit int,
	offset int,
	action string,
	status string,
) ([]Entry, int, error) {
	if s == nil || s.db == nil {
		return nil, 0, fmt.Errorf(
			"audit store is not initialized",
		)
	}

	if limit < 1 {
		limit = 50
	}

	if limit > 100 {
		limit = 100
	}

	if offset < 0 {
		offset = 0
	}

	where := ""

	args := make([]any, 0, 2)

	if action != "" {
		where = " WHERE action = ?"

		args = append(
			args,
			action,
		)
	}

	if status != "" {
		if where == "" {
			where = " WHERE status = ?"
		} else {
			where += " AND status = ?"
		}

		args = append(
			args,
			status,
		)
	}

	var total int

	if err := s.db.QueryRowContext(
		ctx,
		"SELECT COUNT(*) FROM audit_logs"+where,
		args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT
			id,
			created_at,
			username,
			action,
			resource_type,
			resource_name,
			status,
			ip_address,
			user_agent,
			details
		FROM audit_logs
	` + where + `
		ORDER BY id DESC
		LIMIT ?
		OFFSET ?
	`

	listArgs := append(
		[]any{},
		args...,
	)

	listArgs = append(
		listArgs,
		limit,
		offset,
	)

	rows, err := s.db.QueryContext(
		ctx,
		query,
		listArgs...,
	)
	if err != nil {
		return nil, 0, err
	}

	defer rows.Close()

	entries := make(
		[]Entry,
		0,
		limit,
	)

	for rows.Next() {
		var entry Entry

		if err := rows.Scan(
			&entry.ID,
			&entry.CreatedAt,
			&entry.Username,
			&entry.Action,
			&entry.ResourceType,
			&entry.ResourceName,
			&entry.Status,
			&entry.IPAddress,
			&entry.UserAgent,
			&entry.Details,
		); err != nil {
			return nil, 0, err
		}

		entries = append(
			entries,
			entry,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return entries, total, nil
}
