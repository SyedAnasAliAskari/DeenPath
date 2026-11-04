-- Additive bilingual story editions. Existing card definitions, copies and worship records remain intact.
CREATE TABLE IF NOT EXISTS card_stories (
 card_id CHAR(36) PRIMARY KEY, title_urdu VARCHAR(160) NOT NULL, summary TEXT NOT NULL, summary_urdu TEXT NOT NULL,
 english MEDIUMTEXT NOT NULL, urdu MEDIUMTEXT NOT NULL, edition INT NOT NULL DEFAULT 2,
 english_reviewed BOOLEAN NOT NULL DEFAULT FALSE, urdu_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
 review_data JSON NOT NULL, version INT NOT NULL DEFAULT 1,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(card_id) REFERENCES card_definitions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO schema_migrations(version) VALUES('0.4.0-stories');
