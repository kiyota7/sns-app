#!/usr/bin/env bash
# ローカルの backend/sns.db (+ backend/uploads/ 配下のアップロード画像) を
# 削除する。次回 `mvn spring-boot:run` 時にFlywayが空のDBへ自動でV1から
# マイグレーションを適用し、まっさらな状態からシーディングし直せる。
#
# 注意: これはローカル開発用DBファイルの削除であり、本番(EC2上の
# /app/data/sns.db)には一切触れない。バックエンドが起動中の場合は
# 先に停止してから実行すること(起動中に削除すると次の書き込みで
# エラーになる可能性がある)。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../../backend" && pwd)"

read -p "backend/sns.db と backend/uploads/ の中身を削除します。よろしいですか? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "中止しました。"
  exit 0
fi

rm -f "${BACKEND_DIR}/sns.db"
rm -rf "${BACKEND_DIR}/uploads"
mkdir -p "${BACKEND_DIR}/uploads"

echo "[perf-tests] backend/sns.db を削除しました。'mvn spring-boot:run' で再起動すると空のDBが再作成されます。"
