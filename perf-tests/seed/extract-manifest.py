#!/usr/bin/env python3
"""run-seed.sh のヘルパー。k6の標準出力ログから SEED_MANIFEST_JSON: で始まる
console.log の中身を取り出し、整形したJSONとしてファイルに書き出す。

k6はconsole.log()の出力を素の行ではなく、
  time="..." level=info msg="SEED_MANIFEST_JSON:{...}" source=console
のようにlogrus形式でラップし、msgの中身の `"` は `\"` にエスケープする。
そのため、`msg="..."` の中身をJSON文字列リテラルとして正しくアンエスケープしてから
取り出す必要がある(単純な文字列置換だとエスケープを取りこぼす可能性がある)。
"""
import json
import re
import sys

MSG_PATTERN = re.compile(r'msg="((?:[^"\\]|\\.)*)"')
PREFIX = "SEED_MANIFEST_JSON:"


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: extract-manifest.py <k6_output_file> <dest_json_file>", file=sys.stderr)
        return 2

    output_file, dest_file = sys.argv[1], sys.argv[2]
    with open(output_file, encoding="utf-8") as f:
        content = f.read()

    for match in MSG_PATTERN.finditer(content):
        try:
            # logrusのエスケープはJSON文字列のエスケープと互換なので、
            # ダブルクォートで囲んでJSONとしてデコードすればアンエスケープできる。
            unescaped = json.loads('"' + match.group(1) + '"')
        except json.JSONDecodeError:
            continue
        if unescaped.startswith(PREFIX):
            manifest = json.loads(unescaped[len(PREFIX):])
            with open(dest_file, "w", encoding="utf-8") as out:
                json.dump(manifest, out, ensure_ascii=False, indent=2)
                out.write("\n")
            return 0

    print(f"SEED_MANIFEST_JSON not found in {output_file}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
