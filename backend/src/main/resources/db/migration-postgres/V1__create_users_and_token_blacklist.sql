-- db/migration/V1__create_users_and_token_blacklist.sql (SQLite用) のPostgreSQL移植版。
-- テーブル・カラム構成は同一だが、以下の2点のみSQLite方言からPostgreSQL方言に置き換えている:
--   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
--   - `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` → 同じ ISO8601(ミリ秒まで)文字列を生成する
--     to_char(...) 式。created_at/updated_at の型はTEXTのまま変更していない
--     (Post.java/User.java のcreatedAt/updatedAtがString型のため、型を変えると
--     Java/MyBatis側に波及する。今回のスコープでは文字列形式を維持する)。
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    bio VARCHAR(160),
    created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

-- ログアウトされたJWT(のjti)を、有効期限が切れるまで記録しておくためのテーブル。
-- JWTはステートレスな性質上サーバー側で個別に無効化できないため、
-- ログアウト済みトークンをここに登録し、認証フィルタで都度確認することで無効化を実現する。
CREATE TABLE IF NOT EXISTS token_blacklist (
    jti VARCHAR(36) PRIMARY KEY,
    expires_at TEXT NOT NULL
);
