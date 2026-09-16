-- db/migration/V5__add_avatar_url_to_users.sql と同一(SQLite/PostgreSQL両方でポータブルな構文のため無変更)。
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
