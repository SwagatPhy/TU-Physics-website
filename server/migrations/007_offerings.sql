-- 007: batch-wise course offerings (owner decision, 2026-10-06; REPORT.md section 19).
--
-- A course (catalogue entry: code + title) is taught as OFFERINGS: one per
-- batch (programme + joining year) and semester label, with one teacher.
-- Enrolments and class links / notes now belong to an offering, not a course.
--
--   status          active | finished (finished: no automatic enrolment; students
--                   keep read-only access unless the teacher hides the content)
--   is_elective     electives start empty; an admin adds students by hand
--   content_hidden  the teacher hid a finished offering's links and notes
--   programme, batch_year  NULL only for offerings carried over from before
--                   (an admin sets them; until then nobody is enrolled automatically)
--
-- Carrying over existing data: every existing course becomes one offering
-- (same teacher and semester; an inactive course becomes a finished offering
-- with its content hidden, as students couldn't see it before). Its
-- enrolments and links/notes move to that offering. courses.faculty_id,
-- courses.semester and courses.active are no longer used after this.
--
-- enrollments.removed: an admin removed the student by hand. The row stays so
-- automatic enrolment never adds them back; adding them by hand clears it.
--
-- SQLite can't change a primary key or swap a foreign key column in place, so
-- enrollments and resources are rebuilt (new table, copy, drop, rename).
-- MySQL: the same statements work (CREATE / INSERT … SELECT / DROP / RENAME TABLE),
-- with UTC_TIMESTAMP() in place of strftime('%Y-%m-%d %H:%M:%S', 'now').

CREATE TABLE offerings (
	id INTEGER PRIMARY KEY,
	course_id INTEGER NOT NULL REFERENCES courses (id),
	programme VARCHAR(100),
	batch_year INTEGER,
	semester VARCHAR(40) NOT NULL,
	teacher_id INTEGER REFERENCES users (id),
	status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
	is_elective BOOLEAN NOT NULL DEFAULT 0,
	content_hidden BOOLEAN NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL,
	UNIQUE (course_id, programme, batch_year, semester)
);

INSERT INTO offerings (course_id, programme, batch_year, semester, teacher_id, status, is_elective, content_hidden, created_at)
SELECT id, NULL, NULL, semester, faculty_id,
       CASE WHEN active = 1 THEN 'active' ELSE 'finished' END,
       0,
       CASE WHEN active = 1 THEN 0 ELSE 1 END,
       strftime('%Y-%m-%d %H:%M:%S', 'now')
FROM courses;

CREATE TABLE enrollments_new (
	offering_id INTEGER NOT NULL REFERENCES offerings (id),
	user_id INTEGER NOT NULL REFERENCES users (id),
	added_by VARCHAR(10) NOT NULL CHECK (added_by IN ('auto', 'admin', 'migrated')),
	removed BOOLEAN NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL,
	PRIMARY KEY (offering_id, user_id)
);

INSERT INTO enrollments_new (offering_id, user_id, added_by, removed, created_at)
SELECT o.id, e.user_id, 'migrated', 0, strftime('%Y-%m-%d %H:%M:%S', 'now')
FROM enrollments e JOIN offerings o ON o.course_id = e.course_id;

DROP TABLE enrollments;
ALTER TABLE enrollments_new RENAME TO enrollments;
CREATE INDEX idx_enrollments_user ON enrollments (user_id);

CREATE TABLE resources_new (
	id INTEGER PRIMARY KEY,
	offering_id INTEGER NOT NULL REFERENCES offerings (id),
	kind VARCHAR(20) NOT NULL CHECK (kind IN ('class_link', 'notes', 'other')),
	title VARCHAR(200) NOT NULL,
	url VARCHAR(2000),
	visible_from DATETIME,
	created_by INTEGER REFERENCES users (id),
	updated_at DATETIME NOT NULL,
	file_name VARCHAR(255),
	file_stored_as CHAR(32),
	file_size INTEGER,
	file_type VARCHAR(100),
	CHECK (url IS NOT NULL OR file_stored_as IS NOT NULL)
);

INSERT INTO resources_new (id, offering_id, kind, title, url, visible_from, created_by, updated_at,
                           file_name, file_stored_as, file_size, file_type)
SELECT r.id, o.id, r.kind, r.title, r.url, r.visible_from, r.created_by, r.updated_at,
       r.file_name, r.file_stored_as, r.file_size, r.file_type
FROM resources r JOIN offerings o ON o.course_id = r.course_id;

DROP TABLE resources;
ALTER TABLE resources_new RENAME TO resources;
CREATE INDEX idx_resources_offering ON resources (offering_id);
CREATE INDEX idx_offerings_teacher ON offerings (teacher_id);
CREATE INDEX idx_offerings_batch ON offerings (programme, batch_year);
