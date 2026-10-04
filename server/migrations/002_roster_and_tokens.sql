-- 002: self-registration from a roster, and emailed single-use links.
--
-- roster: the list of people allowed to create an account, uploaded by the
-- admin (no passwords). A row is "claimed" once someone registers with it.
-- auth_tokens: registration and password-reset links. Like sessions, only the
-- SHA-256 hash of each token is stored.

CREATE TABLE roster (
	id INTEGER PRIMARY KEY,
	email VARCHAR(254) NOT NULL UNIQUE,
	name VARCHAR(200) NOT NULL,
	roll_number VARCHAR(30) UNIQUE,      -- students only; faculty/staff rows leave it empty
	role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty')),
	programme VARCHAR(50),               -- from the roll-number prefix (server/programmes.conf)
	claimed BOOLEAN NOT NULL DEFAULT 0,
	claimed_at DATETIME,
	user_id INTEGER REFERENCES users (id),
	created_at DATETIME NOT NULL
);

CREATE TABLE auth_tokens (
	id CHAR(64) PRIMARY KEY,
	purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('register', 'reset')),
	roster_id INTEGER REFERENCES roster (id),   -- for 'register'
	user_id INTEGER REFERENCES users (id),      -- for 'reset'
	expires_at DATETIME NOT NULL,
	used_at DATETIME,
	created_at DATETIME NOT NULL
);

CREATE INDEX idx_auth_tokens_user ON auth_tokens (user_id);
CREATE INDEX idx_auth_tokens_roster ON auth_tokens (roster_id);

-- Registered students keep their roll number and programme on their account.
ALTER TABLE users ADD COLUMN roll_number VARCHAR(30);
ALTER TABLE users ADD COLUMN programme VARCHAR(50);
