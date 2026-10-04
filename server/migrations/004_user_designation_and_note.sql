-- 004: a person's job title as shown on the website ("Professor",
-- "Laboratory Assistant", …) and a free-text note for admins (e.g. "TRIAL:
-- roll number made up" on trial data, or why an account was changed).

ALTER TABLE users ADD COLUMN designation VARCHAR(100);
ALTER TABLE users ADD COLUMN admin_note VARCHAR(500);
