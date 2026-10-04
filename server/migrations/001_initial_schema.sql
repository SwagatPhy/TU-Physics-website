-- 001: initial portal schema (see docs/portal-trial/REPORT.md, section 6).
-- Written for SQLite, using SQL that MySQL 8 also accepts, except for the
-- notes in migrations/README.md (auto-increment ids).
-- Dates are UTC "YYYY-MM-DD HH:MM:SS". Booleans are 0/1.

CREATE TABLE users (
	id INTEGER PRIMARY KEY,
	name VARCHAR(200) NOT NULL,
	email VARCHAR(254) NOT NULL UNIQUE,
	password_hash VARCHAR(255) NOT NULL,
	role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
	active BOOLEAN NOT NULL DEFAULT 1,
	must_change_password BOOLEAN NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL,
	last_login_at DATETIME
);

CREATE TABLE courses (
	id INTEGER PRIMARY KEY,
	code VARCHAR(20) NOT NULL,          -- matches the public course catalogue (src/content/courses)
	title VARCHAR(200) NOT NULL,
	semester VARCHAR(40) NOT NULL,
	faculty_id INTEGER REFERENCES users (id),
	active BOOLEAN NOT NULL DEFAULT 1,
	UNIQUE (code, semester)
);

CREATE TABLE enrollments (
	user_id INTEGER NOT NULL REFERENCES users (id),
	course_id INTEGER NOT NULL REFERENCES courses (id),
	PRIMARY KEY (user_id, course_id)
);

CREATE TABLE resources (
	id INTEGER PRIMARY KEY,
	course_id INTEGER NOT NULL REFERENCES courses (id),
	kind VARCHAR(20) NOT NULL CHECK (kind IN ('class_link', 'notes', 'other')),
	title VARCHAR(200) NOT NULL,
	url VARCHAR(2000) NOT NULL,
	visible_from DATETIME,
	created_by INTEGER REFERENCES users (id),
	updated_at DATETIME NOT NULL
);

-- id is a SHA-256 hash of the session token; the token itself only lives in
-- the visitor's cookie, so a copy of the database can't be used to log in.
CREATE TABLE sessions (
	id CHAR(64) PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users (id),
	created_at DATETIME NOT NULL,
	last_seen_at DATETIME NOT NULL,
	expires_at DATETIME NOT NULL,
	ip VARCHAR(45),
	user_agent VARCHAR(500)
);

CREATE TABLE audit_log (
	id INTEGER PRIMARY KEY,
	actor_id INTEGER REFERENCES users (id),
	action VARCHAR(50) NOT NULL,
	target VARCHAR(200),
	at DATETIME NOT NULL
);

CREATE INDEX idx_courses_faculty ON courses (faculty_id);
CREATE INDEX idx_enrollments_course ON enrollments (course_id);
CREATE INDEX idx_resources_course ON resources (course_id);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_audit_log_at ON audit_log (at);
