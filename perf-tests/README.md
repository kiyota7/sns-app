# perf-tests — RaiseTimeLine バックエンド パフォーマンステスト

[k6](https://k6.io/) を使った、**ローカル環境限定・手動実行専用**のバックエンドAPI
パフォーマンステスト一式です。CIには組み込まれておらず、必要なときに開発者が
自分のマシンから任意のタイミングで実行する運用を想定しています。

## 1. これは何か / 何でないか

- ✅ ローカルで `mvn spring-boot:run`(または `docker-compose.prod.yml` をローカルで
  起動したもの)に対して負荷をかけ、特性を確認するためのツールです。
- ✅ バックエンドREST APIのみが対象です(フロントエンドの表示速度等は対象外)。
- ❌ **CI(`.github/workflows/ci.yml`)には含まれていません。** `frontend/e2e`の
  Playwright E2Eテストとは異なり、このk6スイートは意図的にCI対象外のまま
  ローカル専用にしています(実行のたびに負荷をかける性質上、CIの共有ランナーで
  自動実行するのに適さないため)。
- ❌ **本番(AWS EC2)やその他のリモート環境には絶対に向けないでください。**
  本番はRDSもステージング環境も無い単一のt3.micro EC2インスタンスで、
  DBはSQLite(ファイルベース・単一ライター)です。実サービスを使っている
  ユーザーに直接影響が出ます。
  - 安全策として、`BASE_URL` が `http://localhost` または `http://127.0.0.1` で
    始まらない場合、各スクリプトは `setup()` の時点で例外を投げて実行を
    中断します(`perf-tests/config/environment.ts` の `assertLocalOnly()`)。
    ただし、これはあくまで最後の砦です。**`BASE_URL` を手で書き換えて
    本番のURLを指定するようなことは絶対にしないでください。**

## 2. k6のインストール

```bash
brew install k6
```

その他のOSは [k6公式のインストール手順](https://k6.io/docs/get-started/installation/) を参照してください。

なお `perf-tests/seed/run-seed.sh` は結果ファイルの書き出しに `python3` を使います
(k6のスクリプト自体はサンドボックスの制約でファイルを書き込めないため)。
macOSには標準で入っているので、通常は追加インストール不要です。

## 3. バックエンドをローカルで起動する

このプロジェクトの規約により、バックエンドは必ずポート **8080** で起動します
(`CLAUDE.md` / `docs/ローカル開発環境セットアップ.md` 参照)。

```bash
cd backend
mvn spring-boot:run
```

`docker-compose.prod.yml` をローカルで使うことも可能です(ファイル名に `prod` と
付いていますが、ローカルで起動する分には問題ありません。実際に本番AWS環境の
リソースを指す設定をしない限り「本番」にはなりません)。ただしその場合は
バックエンドがポート公開されておらず frontend コンテナ経由になる点に注意して
ください(`docker-compose.prod.yml` 参照)。特別な理由がなければ `mvn spring-boot:run`
の方が単純です。

## 4. データのシーディング

パフォーマンステストの多くのシナリオ(特に `unbounded-results.ts` や
`write-contention.ts`)は、DBにある程度のデータ量が無いと意味のある結果になりません。
必ず先にシードスクリプトを実行してください。

```bash
cd perf-tests/seed
./run-seed.sh
```

- デフォルトで通常ユーザー約50人・パワーユーザー3人(各50〜100投稿、うち1件は
  コメント150件・いいね40件の「バズった投稿」)を作成します。ローカル環境で
  数分程度で完了します(登録時のBCryptハッシュ化コストが支配的です)。
- より大きなデータ量で試したい場合は環境変数で調整できます
  (`perf-tests/seed/seed-config.ts` 参照。例: `SEED_USER_COUNT=200 ./run-seed.sh`)。
- 完了すると `perf-tests/results/seed-manifest.json` が生成されます。各シナリオは
  ここに書かれた「バズった投稿のID」「パワーユーザーのID」等を参照するので、
  **`k6 run seed.ts` を直接実行せず、必ず `run-seed.sh` 経由で実行してください**
  (k6のスクリプト自体はサンドボックスの制約でファイルを書き出せないため、
  `run-seed.sh` が標準出力からマニフェストを拾ってファイル化しています)。
- 既存のシードデータをやり直したい場合は、バックエンドを止めてから
  `./reset-db.sh` を実行してください(`backend/sns.db` と `backend/uploads/` を
  削除します。**ローカルの開発用DBファイルのみが対象で、本番DBには一切触れません**)。

## 5. シナリオの実行

推奨する実行順序: `smoke.ts` → `baseline-read.ts` → `write-contention.ts` →
`unbounded-results.ts`。いきなり一番重いシナリオを流すのではなく、軽いものから
順に「バックエンドがちゃんと応答しているか」を確認しながら進めてください。

```bash
# 1. 疎通確認(シード不要)
k6 run perf-tests/scenarios/smoke.ts

# 2. 読み取り中心の負荷(ベースライン計測)
k6 run perf-tests/scenarios/baseline-read.ts
VUS=30 DURATION=3m k6 run perf-tests/scenarios/baseline-read.ts   # VU数・時間を変える例

# 3. 同時書き込み負荷(SQLite競合の確認。このアプリで一番重要なシナリオ)
k6 run perf-tests/scenarios/write-contention.ts

# 4. ページネーション無しエンドポイントの負荷
k6 run perf-tests/scenarios/unbounded-results.ts
```

各スクリプトの `VUS` / `DURATION` 環境変数でVU数・実行時間を上書きできます
(`baseline-read.ts` の `DURATION` は「目標VU数を維持する時間」で、前後に
ランプアップ20秒・ランプダウン10秒が付くため、実際の総実行時間は
`DURATION + 30秒` 程度になります)。
デフォルト値は、本番想定のt3.micro(2vCPUバースト・1GB RAM)と、ローカルPC上で
JVMバックエンドとk6自身が同居する制約を踏まえた控えめな値です。数千〜数万VUの
ような値は、アプリではなくローカルマシン自体のリソース不足によるノイズを
生むだけなので推奨しません。

`spike.ts` / `soak.ts` は今回は未実装のスタブです(ファイル内コメント参照)。

## 6. 結果の読み方

### 通常の実行

k6標準の実行後サマリー(標準出力)を見れば十分です。`http_req_duration{name:...}`の
ようにエンドポイント別の分布が確認できます。

### 記録を残したい場合

```bash
k6 run --out json=perf-tests/results/baseline-read-$(date +%Y%m%d-%H%M%S).json \
  perf-tests/scenarios/baseline-read.ts
```

`perf-tests/results/` はgitignore対象なので、コミットせず手元だけで比較に使ってください
(例: インデックス追加前後でp95がどう変わったかを見る、など)。k6のWeb Dashboard
(`K6_WEB_DASHBOARD=true k6 run ...`)を使うこともできますが、ブラウザ表示が
必要になるのでオプション扱いです。

### `write-contention.ts` の見方(重要)

このシナリオは**エラーが出ないことを確認するテストではありません**。SQLiteは
単一ライターのため、同時書き込み負荷をかけると一定数の失敗が出ること自体が
「このアプリの現状の特性」です。以下を確認してください。

- サマリーの `checks` 合格率(しきい値は緩めに `> 90%` に設定)
- `write_server_errors` カウンター(エンドポイント別のtag付き)の件数
- `http_req_duration{name:POST /api/posts/:id/likes}` 等のp95/p99が、
  単独実行時と比べてどれだけ悪化しているか

500が出た場合、レスポンスボディは `{"error": "予期しないエラーが発生しました。"}`
という汎用メッセージです(`GlobalExceptionHandler.handleUnexpected`)。実際に
何が起きたか知りたい場合は、バックエンドのログで `unexpected exception` を
grepし、`exception_type` の値(`org.sqlite.SQLiteException` 等)を確認してください。

### `unbounded-results.ts` の見方

`unbounded_comments_response_bytes` / `unbounded_user_posts_response_bytes` という
カスタムTrendメトリクスで、1リクエストあたりのレスポンスサイズを記録しています。
レイテンシだけでなく、このバイト数がシード投入前と比べてどれだけ大きくなったかも
合わせて見ることで、「ページネーション無し・インデックス無し」の影響を確認できます。

## 7. 本番には絶対に向けないこと(再掲)

しつこいようですが重要なので改めて書きます。本番は単一のEC2インスタンス上の
ファイルベースSQLiteで、ステージング環境もありません。このディレクトリの
スクリプトはローカル開発環境専用です。`BASE_URL` に本番のElastic IPやドメインを
指定するようなことは絶対にしないでください。

## 今後の検討事項(このタスクでは未実装)

パフォーマンステストの設計過程で気づいた、アプリ本体側の改善候補です。
今回のタスクではテスト基盤の追加のみを行い、以下はあえて実装していません。

- **Hikariプールサイズの見直し**: `backend/src/main/resources/application.properties`
  にはdev/prod向けのHikariプール上書きが無く、既定の10のままです。SQLiteは
  同時に書き込めるコネクションが実質1つのため、プールを絞っておいた方が
  (競合時に30秒待たされて曖昧にタイムアウトするより)早く・明確に失敗を返せる
  可能性があります。
- **SQLiteの`busy_timeout`が未設定**: 明示的に設定されておらず、ドライバの
  既定値に委ねられています。意図した値を明示的に設定することを検討してください。
- **`posts.user_id` / `comments.post_id` / `follows.followed_id` へのインデックス追加**:
  現状FlywayマイグレーションにはPKと2つのUNIQUE複合制約しかありません。
- **`GET /api/posts/{postId}/comments` / `GET /api/users/{id}/posts` へのページネーション追加**:
  現状は全件返却です。`unbounded-results.ts` はこの影響を計測するためのシナリオです。
- **レート制限**: 現状未実装です。将来的に本番に何らかの形で負荷試験を行う
  可能性が出てきた場合は、その前提として検討が必要です(今回のテストは
  ローカル限定のため対象外)。
