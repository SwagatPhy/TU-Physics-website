-- 005: notes can carry an uploaded file (REPORT.md section 18).
--
-- resources now holds two kinds of item per course:
--   class_link  title + url (required)
--   notes       title + file and/or url (at least one); 'other' rows from
--               earlier versions are shown with the notes.
-- So url becomes optional, and four file columns are added. The file itself
-- is stored on the server outside the web root (server/data/uploads/) under the
-- random name in file_stored_as; file_name is only the name shown to people.
--
-- SQLite can't drop NOT NULL from a column, so the table is rebuilt.
-- MySQL: ALTER TABLE resources MODIFY url VARCHAR(2000) NULL, then ADD the four columns.

CREATE TABLE resources_new (
	id INTEGER PRIMARY KEY,
	course_id INTEGER NOT NULL REFERENCES courses (id),
	kind VARCHAR(20) NOT NULL CHECK (kind IN ('class_link', 'notes', 'other')),
	title VARCHAR(200) NOT NULL,
	url VARCHAR(2000),
	visible_from DATETIME,
	created_by INTEGER REFERENCES users (id),
	updated_at DATETIME NOT NULL,
	file_name VARCHAR(255),        -- original name, for display and download
	file_stored_as CHAR(32),       -- random name of the file in server/data/uploads/
	file_size INTEGER,             -- bytes
	file_type VARCHAR(100),        -- MIME type it is served with
	CHECK (url IS NOT NULL OR file_stored_as IS NOT NULL)
);

INSERT INTO resources_new (id, course_id, kind, title, url, visible_from, created_by, updated_at)
SELECT id, course_id, kind, title, url, visible_from, created_by, updated_at FROM resources;

DROP TABLE resources;
ALTER TABLE resources_new RENAME TO resources;
CREATE INDEX idx_resources_course ON resources (course_id);
