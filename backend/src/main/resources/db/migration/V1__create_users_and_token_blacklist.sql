CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    bio VARCHAR(160),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ログアウトされたJWT(のjti)を、有効期限が切れるまで記録しておくためのテーブル。
-- JWTはステートレスな性質上サーバー側で個別に無効化できないため、
-- ログアウト済みトークンをここに登録し、認証フィルタで都度確認することで無効化を実現する。
CREATE TABLE IF NOT EXISTS token_blacklist (
    jti VARCHAR(36) PRIMARY KEY,
    expires_at TEXT NOT NULL
);
