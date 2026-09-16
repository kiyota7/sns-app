-- db/migration/V4__create_follows.sql (SQLite用) のPostgreSQL移植版。詳細はV1のコメント参照。
CREATE TABLE IF NOT EXISTS follows (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    follower_id BIGINT NOT NULL REFERENCES users(id),
    followed_id BIGINT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    UNIQUE (follower_id, followed_id)
);
