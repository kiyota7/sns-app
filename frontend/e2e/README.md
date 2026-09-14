# e2e — RaiseTimeLine フロントエンド E2Eテスト

[Playwright](https://playwright.dev/) を使った、**実バックエンド・実ブラウザ(Chromium)**での
E2Eテスト一式です。[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)により
PRごとにCI上で自動実行されるほか、ローカルからも同じ手順で実行できます。

## 1. これは何か / 何でないか

- ✅ 実際のバックエンド(Spring Boot)と実際のブラウザ(Chromium)を使い、
  複数ページ・複数ユーザーをまたぐ実際のユーザー行動を確認するテストです。
- ✅ `frontend/src/**/__tests__`のVitestテスト(65件、各コンポーネント単体を
  モックAPI相手にテスト)では検証できない領域 — 実際のログイン永続化、
  別ユーザーの操作が自分の画面に反映されるか、実画像アップロードなど — に
  絞って書かれています。すでにVitestでカバーされているフォームのバリデーション
  文言や、いいね/編集/削除の楽観的UI更新のロジック自体は、ここでは
  再テストしていません。
- ❌ 本番やその他のリモート環境は対象外です。`playwright.config.ts`の`baseURL`は
  `http://localhost:5173`固定で、環境変数での上書きもできません
  (`perf-tests`の`assertLocalOnly()`と同じ考え方です)。

## 2. セットアップ

```bash
cd frontend
npm install
npx playwright install chromium
```

`npm install`だけでは`@playwright/test`パッケージが入るだけで、実際に操作する
Chromium本体はダウンロードされません。**`npx playwright install chromium`は
別途、明示的に実行する必要があります**(初回のみ)。

(CI(`.github/workflows/ci.yml`)では、素のUbuntuランナーにheadless Chromiumに
必要なシステムライブラリが無いため、`npx playwright install --with-deps chromium`
を実行しています。ローカルの開発環境では通常システムライブラリが揃っているため、
上記の`--with-deps`無しのコマンドで問題ありません。)

## 3. サーバーの起動

バックエンドは自動起動しません。E2Eを実行する前に、必ず自分で先に起動してください。

```bash
cd backend
mvn spring-boot:run
```

(`docs/ローカル開発環境セットアップ.md`、または`start-dev-servers` skillも参照)

フロントエンド(ポート5173)は`npm run test:e2e`実行時にPlaywrightが自動起動します
(既に`npm run dev`で起動済みの場合はそれを再利用します)。バックエンドが
起動していない場合は、個々のテストが分かりにくいタイムアウトで失敗する前に
`e2e/global-setup.ts`が疎通確認を行い、分かりやすいメッセージですぐに停止します。

## 4. 実行方法

```bash
# 全specを実行
npm run test:e2e

# 特定のファイルだけ実行
npx playwright test auth.spec.ts

# インタラクティブなUIモードでデバッグ
npm run test:e2e:ui

# 直近の実行結果のHTMLレポートを開く
npx playwright show-report
```

失敗したテストは`trace`/`screenshot`/`video`が`e2e/test-results/`に残ります
(いずれもgitignore対象)。特に`trace`はPlaywrightのTrace Viewerで
ステップごとの状態を確認できるため、失敗調査に一番役立ちます。

## 5. データの扱い

各テストは、実行のたびに使い捨てのユーザーを自分でUI経由(`/signup`)から
登録します。`perf-tests/seed/`のような事前のシード投入やDBリセットは
不要かつ非対応です — 誰かが先にテストを実行していても、DBに何が残っていても、
毎回新しく作られるユーザー名・メールアドレスで動くため影響を受けません。

## 6. 並列実行とSQLiteの書き込み競合について

`playwright.config.ts`は`workers: 2`・`retries: 1`を設定しています。これは
一般的なCI向けの緩衝材ではなく、`perf-tests/scenarios/write-contention.ts`で
実測済みの通り、このアプリの本番・開発環境のDBがSQLite(単一ライター)である
ことに由来する、意図的な措置です。各E2Eテストは実際にユーザー登録・投稿・
いいね・フォローといった書き込みを行うため、並列数を上げすぎると
`database is locked`系の偶発的な失敗(flaky)が起きやすくなります。

- flakyな失敗が頻発する場合は `npx playwright test --workers=1` を試してください。
- retryが発生した場合、それは「本当に書き込み競合だっただけ」なのか
  「実際のバグ」なのかを、trace(失敗時に自動保存されます)で確認する習慣を
  つけてください。

## 7. パフォーマンス計測結果の見方

`performance.spec.ts`はブラウザパフォーマンスの**記録専用**テストです。
`expect().toBeLessThan()`のような失敗しきい値は一切設けていません
(CI上のGitHub Actionsランナーも、開発者ごとのローカルマシンも、負荷や
スペックが実行のたびに変動する共有環境である以上、厳密な合否判定をしても
値の根拠が主観的になりやすいためです。`perf-tests`のk6スイートと同じ考え方です)。

```bash
npx playwright test performance.spec.ts
```

実行すると:
- コンソールに Navigation/Paint Timing と操作単位の所要時間の一覧表が出ます
- `e2e/results/run-<timestamp>.json`(gitignore対象)にも同じ内容が書き出されます

変更の前後で2つの`run-*.json`を見比べる、あるいはコンソールの表を目で
比較する、という使い方を想定しています。

計測している内容:
- ログイン画面(未認証・冷えた状態)、ログイン後の`/timeline`、投稿詳細ページの
  Navigation Timing(TTFB・domInteractive・domContentLoaded・loadEvent)と
  Paint Timing(first-paint・first-contentful-paint)
  - これらは`page.goto()`による実ナビゲーション(ハードリロード相当)で
    計測しています。`performance.getEntriesByType('navigation')`は
    ブラウザの実際のページ読み込み1回につき1エントリしか記録されず、
    vue-routerによるSPA内のクライアントサイド遷移(リンククリック)では
    新しいエントリが生まれないためです。
- 投稿作成(テキストのみ/画像あり、それぞれ別に計測)、無限スクロールでの
  次ページ描画、検索クエリ入力から結果描画までの、それぞれの操作にかかった時間

**含めていないもの**: ChromiumのCDP経由のメトリクス(JSヒープサイズ、
レイアウト回数など、`page.context().newCDPSession(page)` →
`.send('Performance.enable')` → `.send('Performance.getMetrics')`で取得可能)は、
今回のスコープでは実装していません。Navigation/Paint Timingと操作時間の計測で
「投稿がサクサクか」「無限スクロールが速く感じるか」といったこのアプリの
UX上の関心事は十分カバーできると判断したためです。特定の不具合(例:
無限スクロールを繰り返した際のメモリリーク調査)で必要になった場合は、
上記の方法でCDPセッションを開いて個別に追加してください。

## 8. CIとローカルの両方で実行される

このスイートはGitHub Actions CI(PRごと・`main`へのマージ時に自動実行)と、
ローカル(本ドキュメントの手順)の両方で実行されます。ローカルでの実行方法・
設定自体に、CI導入による変更はありません。対象は常に
`http://localhost:5173`と`http://localhost:8080`のみで、CI上でもこの2つの
URLに対して実行しています(本番やその他のリモート環境を対象にすることはありません)。
