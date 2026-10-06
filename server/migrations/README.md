# Migrations

Numbered SQL files, applied in order by `npm run migrate` (and automatically when the
server starts). Each file runs once; applied files are recorded in `schema_migrations`.

- Never edit a file that has already been applied anywhere. Add a new, higher-numbered file.
- Name: `NNN_short_description.sql` (e.g. `002_add_course_room.sql`).

## SQLite (trial) vs MySQL (possible production)

The SQL is written to work in both, with one difference:

| Thing | SQLite (as written) | MySQL 8 |
|---|---|---|
| Auto-numbered ids | `id INTEGER PRIMARY KEY` | `id INTEGER PRIMARY KEY AUTO_INCREMENT` |

Everything else (VARCHAR, BOOLEAN as 0/1, DATETIME as UTC text, CHECK constraints,
`REFERENCES`, `UNIQUE`, indexes) is accepted by both. MySQL enforces CHECK constraints from
8.0.16.

**Table rebuilds.** SQLite cannot drop `NOT NULL` from a column, so `005_note_files.sql`
rebuilds `resources` (new table, copy rows, drop, rename). On MySQL, use the one-line
`ALTER TABLE … MODIFY` given in that file's header instead.
