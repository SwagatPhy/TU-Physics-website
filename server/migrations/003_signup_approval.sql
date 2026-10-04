-- 003: open sign-up with admin approval (the roster becomes optional).
--
-- users.status: 'pending' until an admin approves a self-registered account,
-- 'approved', or 'rejected'. Accounts that existed before this migration
-- (seeded, admin-created, or registered from the roster) are approved.
-- signups: what someone typed on the sign-up form, kept until they verify
-- their email; the account is only created then.

ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'approved'
	CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE users ADD COLUMN phone VARCHAR(30);

-- One account per roll number (several NULLs are allowed: staff have none).
CREATE UNIQUE INDEX idx_users_roll_number ON users (roll_number);
CREATE INDEX idx_users_status ON users (status);

CREATE TABLE signups (
	id INTEGER PRIMARY KEY,
	kind VARCHAR(20) NOT NULL CHECK (kind IN ('student', 'member')),  -- member = faculty, scholar or staff
	name VARCHAR(200) NOT NULL,
	email VARCHAR(254) NOT NULL,
	roll_number VARCHAR(30),
	programme VARCHAR(50),
	phone VARCHAR(30) NOT NULL,
	roster_id INTEGER REFERENCES roster (id),   -- set when a student matched an unclaimed roster row
	created_at DATETIME NOT NULL
);

CREATE INDEX idx_signups_email ON signups (email);

ALTER TABLE auth_tokens ADD COLUMN signup_id INTEGER REFERENCES signups (id);
