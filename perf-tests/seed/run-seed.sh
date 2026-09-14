#!/usr/bin/env bash
# seed.ts を実行し、標準出力に出てくる `SEED_MANIFEST_JSON:` 行を拾って
# perf-tests/results/seed-manifest.json に書き出す。
#
# k6 スクリプト自身はファイルを書き込めない(サンドボックスの制約)ため、
# このシェルスクリプトが「k6の実行」と「結果ファイルの書き出し」を橋渡しする。
# 各シナリオ(write-contention.ts / unbounded-results.ts 等)は
# results/seed-manifest.json を前提に動くので、シード投入は必ずこのスクリプト
# 経由で行うこと(`k6 run seed.ts` を直接叩いても投入自体はできるが、
# マニフェストファイルが更新されない)。
#
# 抽出がやや込み入っている理由: k6は console.log() の出力を、素の行としてではなく
# logrus形式(例: time="..." level=info msg="SEED_MANIFEST_JSON:{...}" source=console)
# でラップし、msgの中身に含まれる `"` は `\"` にエスケープして出力する。そのため
# 単純な行頭一致だけでは取り出せず、Python標準ライブラリでJSON文字列として
# 正しくアンエスケープしてから取り出している(python3はmacOS標準搭載)。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

mkdir -p "${PERF_DIR}/results"

echo "[perf-tests] running seed.ts ..."
OUTPUT_FILE="$(mktemp)"
trap 'rm -f "${OUTPUT_FILE}"' EXIT

# k6の標準出力をそのまま画面に出しつつ、あとでマニフェスト行を探せるように
# 一時ファイルにも保存する。
k6 run "${SCRIPT_DIR}/seed.ts" "$@" | tee "${OUTPUT_FILE}"

if ! python3 "${SCRIPT_DIR}/extract-manifest.py" "${OUTPUT_FILE}" "${PERF_DIR}/results/seed-manifest.json"; then
  echo "" >&2
  echo "[perf-tests] エラー: SEED_MANIFEST_JSON をk6の出力から取り出せませんでした。" >&2
  echo "seed.ts が途中で失敗した可能性があります。上のログを確認してください。" >&2
  exit 1
fi

echo ""
echo "[perf-tests] 書き出しました: perf-tests/results/seed-manifest.json"
