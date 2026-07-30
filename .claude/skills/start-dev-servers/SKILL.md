---
name: start-dev-servers
description: Use this skill whenever starting, restarting, running, or verifying the backend or frontend dev servers for this taskboard project (Spring Boot backend on port 8080, Vite+React frontend on port 5173), and whenever a port conflict comes up (address already in use, EADDRINUSE, "port already bound", "ポートが競合", starting a server before verifying). Always consult this skill instead of falling back to a different free port — this project's configs (e.g. frontend/vite.config.js proxying /api to http://localhost:8080) hardcode these exact ports, so servers must always end up running on their designated default port, never an alternative one.
---

# デフォルトポートでのサーバー起動

このプロジェクトの開発環境は固定ポートを前提にしている。

- バックエンド(Spring Boot, `backend/`): **8080**
- フロントエンド(Vite + React, `frontend/`): **5173**

`frontend/vite.config.js`の`server.proxy`は`/api` → `http://localhost:8080`を固定で参照しているため、
バックエンドが8080以外のポートで起動すると、画面は表示されてもAPI通信だけが失敗するという
分かりにくい不具合につながる。フロントエンドについても、5173以外のポートで動かすと、ブラウザの
ブックマークや起動スクリプトなど他の前提が崩れる。そのため、**空いている別のポートに一時的に
逃がす、という対応はしない**。

## 起動手順

1. 起動したいポートが既に使われていないか確認する。
   ```bash
   lsof -i :8080   # backend
   lsof -i :5173   # frontend
   ```
2. 使用中であれば、該当プロセスを特定して停止する。
   ```bash
   kill <PID>
   ```
   反応がなければ`kill -9 <PID>`。停止後、`lsof`で該当ポートが解放されたことを確認する。
3. ポートが空いた状態で、同じデフォルトポートでサーバーを起動する。
   - backend: `cd backend && mvn spring-boot:run`(またはビルド済みjarを`java -jar`で実行)
   - frontend: `cd frontend && npm run dev`(vite.config.jsで`--port`を指定していない場合はデフォルトの
     5173が使われる。念のためズレていないか確認し、必要なら`npm run dev -- --port 5173`のように明示する)
4. 起動後は実際に疎通確認する。
   - backend: `curl http://localhost:8080/api/health` が `{"status":"ok"}` を返すこと
   - frontend: ブラウザで`http://localhost:5173`にアクセスし、コンソールエラー・失敗したネットワーク
     リクエストがないことを確認する

## ポートが解放できない場合

ゾンビプロセスや別アプリとの競合など、`kill`しても同じポートで別プロセスがすぐ立ち上がってしまう
ようなケースでは、原因(何がそのポートを掴んでいるか、なぜ再度立ち上がるのか)を調べて解消する。
それでも解決できない場合は、別ポートに逃がして黙って進めるのではなく、状況をユーザーに説明して
判断を仰ぐ。
