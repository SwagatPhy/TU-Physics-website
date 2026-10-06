-- 006: a student's batch = programme + joining year (owner decision, 2026-10-06).
--
-- Roll numbers are PREFIX + 2-digit joining year + 3-digit serial (PHP22017:
-- PhD, joined 2022). The year is stored at sign-up so courses can be offered
-- to a whole batch. Existing students with a roll number in that format get
-- theirs filled in here; anything else stays NULL (an admin can correct the
-- roll number, which sets it).
--
-- substr/CAST/LIKE work the same in MySQL.

ALTER TABLE users ADD COLUMN batch_year INTEGER;

UPDATE users
SET batch_year = 2000 + CAST(substr(roll_number, 4, 2) AS INTEGER)
WHERE role = 'student'
  AND (roll_number LIKE 'PHM_____' OR roll_number LIKE 'PHI_____' OR roll_number LIKE 'PHP_____');
