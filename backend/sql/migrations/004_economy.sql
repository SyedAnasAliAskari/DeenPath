-- DeenPath v0.4.0 ADDITIVE expansion; back up first. Never replaces existing worship records.
CREATE TABLE IF NOT EXISTS gem_wallets (
 user_id CHAR(36) PRIMARY KEY, balance BIGINT NOT NULL DEFAULT 0, studio_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS gem_claims (
 user_id CHAR(36) NOT NULL, source VARCHAR(255) NOT NULL, kind VARCHAR(20) NOT NULL,
 amount INT NOT NULL, active BOOLEAN NOT NULL, revision INT NOT NULL, rates JSON NOT NULL,
 PRIMARY KEY(user_id,source), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS gem_transactions (
 user_id CHAR(36) NOT NULL, id CHAR(64) NOT NULL, source VARCHAR(255) NOT NULL, kind VARCHAR(30) NOT NULL,
 delta BIGINT NOT NULL, balance_after BIGINT NOT NULL, data JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id), INDEX(user_id,created_at), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS economy_orders (
 user_id CHAR(36) NOT NULL, id CHAR(36) NOT NULL, request_hash CHAR(64) NOT NULL,
 kind VARCHAR(30) NOT NULL, cost INT NOT NULL, result JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS user_customizations (
 user_id CHAR(36) PRIMARY KEY, data JSON NOT NULL, revision BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS card_definitions (
 id CHAR(36) PRIMARY KEY, title VARCHAR(160) NOT NULL, category VARCHAR(30) NOT NULL, rarity VARCHAR(12) NOT NULL,
 story TEXT NOT NULL, reference_data JSON NOT NULL, verification VARCHAR(20) NOT NULL DEFAULT 'draft',
 status VARCHAR(20) NOT NULL DEFAULT 'draft', generation_date DATETIME NULL, verified_at DATETIME NULL,
 verified_by VARCHAR(100) NULL, version INT NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(status,verification,rarity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS card_artwork (
 id CHAR(36) PRIMARY KEY, card_id CHAR(36) NOT NULL, disk_name VARCHAR(100) NOT NULL UNIQUE,
 sha256 CHAR(64) NOT NULL, mime VARCHAR(50) NOT NULL, provider VARCHAR(80) NOT NULL, license_data JSON NOT NULL,
 verified BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(card_id) REFERENCES card_definitions(id), INDEX(card_id,verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS owned_cards (
 user_id CHAR(36) NOT NULL, id CHAR(36) NOT NULL, card_id CHAR(36) NOT NULL, order_id CHAR(36) NOT NULL,
 position TINYINT NOT NULL, revealed BOOLEAN NOT NULL DEFAULT FALSE, acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,id), UNIQUE(user_id,order_id,position), INDEX(user_id,card_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(card_id) REFERENCES card_definitions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS card_reports (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, card_id CHAR(36) NOT NULL, reason VARCHAR(30) NOT NULL,
 detail TEXT NOT NULL, credible BOOLEAN NOT NULL DEFAULT TRUE, status VARCHAR(20) NOT NULL DEFAULT 'open',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,card_id), INDEX(card_id,status,credible),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(card_id) REFERENCES card_definitions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS card_audit (
 id CHAR(36) PRIMARY KEY, card_id CHAR(36) NOT NULL, actor VARCHAR(100) NOT NULL, action VARCHAR(40) NOT NULL,
 data JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(card_id,created_at),
 FOREIGN KEY(card_id) REFERENCES card_definitions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS generation_jobs (
 id CHAR(36) PRIMARY KEY, content_key CHAR(64) NOT NULL UNIQUE, card_id CHAR(36) NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'queued', attempts INT NOT NULL DEFAULT 0, provider VARCHAR(80) NOT NULL,
 payload JSON NOT NULL, result JSON NULL, error_code VARCHAR(80) NULL, available_at DATETIME NOT NULL,
 lease_until DATETIME NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(status,available_at), FOREIGN KEY(card_id) REFERENCES card_definitions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS provider_budgets (
 day DATE NOT NULL, provider VARCHAR(80) NOT NULL, reserved_units INT NOT NULL DEFAULT 0,
 completed_jobs INT NOT NULL DEFAULT 0, PRIMARY KEY(day,provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS google_identities (
 subject VARCHAR(255) PRIMARY KEY, user_id CHAR(36) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS google_signin_challenges (
 nonce_hash CHAR(64) PRIMARY KEY, expires_at DATETIME NOT NULL, consumed BOOLEAN NOT NULL DEFAULT FALSE,
 INDEX(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS card_content_fingerprints (
 content_hash CHAR(64) PRIMARY KEY, card_id CHAR(36) NOT NULL,
 INDEX(card_id), FOREIGN KEY(card_id) REFERENCES card_definitions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES('0.4.0');
