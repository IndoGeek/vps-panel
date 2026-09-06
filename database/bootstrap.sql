CREATE DATABASE IF NOT EXISTS vps_panel
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'vps_panel'@'127.0.0.1'
    IDENTIFIED BY 'Tanmay';

ALTER USER 'vps_panel'@'127.0.0.1'
    IDENTIFIED BY 'Tanmay';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX
    ON vps_panel.*
    TO 'vps_panel'@'127.0.0.1';

FLUSH PRIVILEGES;

USE vps_panel;

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
