// シードデータ(results/seed-manifest.json)の読み込みと、テスト本文生成・
// 重み付きランダム選択などの雑多なヘルパー。
//
// 注意: k6 の open() はinitコンテキスト(モジュール読み込み時)でのみ呼べるため、
// ここではトップレベルで一度だけ読み込む。ファイルが無い場合は null のまま返し、
// 呼び出し側(各シナリオの setup())で「seed.js を先に実行してください」という
// 分かりやすいエラーを出す。
let manifest = null;
try {
  manifest = JSON.parse(open('../results/seed-manifest.json'));
} catch (e) {
  manifest = null;
}

export function getManifest() {
  return manifest;
}

export function requireManifest() {
  if (!manifest) {
    throw new Error(
      '[perf-tests] results/seed-manifest.json が見つかりません。' +
        '先に `k6 run perf-tests/seed/seed.js` を実行してデータを投入してください。'
    );
  }
  return manifest;
}

// 重み付きランダム選択。例: weightedPick([['a', 0.5], ['b', 0.3], ['c', 0.2]])
export function weightedPick(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let r = Math.random() * total;
  for (const [value, weight] of entries) {
    if (r < weight) return value;
    r -= weight;
  }
  return entries[entries.length - 1][0];
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// poolSize 件のうち count 件を重複なく選び、そのインデックスの配列を返す。
// いいね・フォローは (post_id, user_id) / (follower_id, followed_id) が
// UNIQUE制約かつAPIがトグル方式のため、同じ相手を2回選ぶと「いいねした→
// 取り消した」になり、意図した件数より少なく登録されてしまう。それを防ぐための
// 部分Fisher-Yatesシャッフル。
export function randomDistinctIndices(poolSize, count) {
  const n = Math.min(count, poolSize);
  const indices = Array.from({ length: poolSize }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(0, poolSize - i - 1);
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices.slice(0, n);
}

export function randomPostBody() {
  const topics = [
    '今日のランチは', '週末は', '最近ハマっているのは', 'ふと思ったんだけど',
    '仕事終わりに', '新しく始めた趣味は', '天気がいいので', '久しぶりに',
  ];
  const tails = [
    '最高だった。', 'なかなか良かった。', 'また行きたい。', '次はどうしようかな。',
    'おすすめです。', '思ったより時間がかかった。', 'びっくりした。', 'やってみて良かった。',
  ];
  const topic = topics[randomInt(0, topics.length - 1)];
  const tail = tails[randomInt(0, tails.length - 1)];
  return `${topic}${tail} (perf-test ${Date.now()}-${randomInt(0, 999999)})`;
}

export function randomCommentBody() {
  const comments = [
    'いいですね!', 'わかります。', 'それは気になる。', 'ナイスです。',
    '今度試してみます。', 'コメント失礼します。', 'すごい!', 'いいねしました。',
  ];
  return `${comments[randomInt(0, comments.length - 1)]} (perf-test ${randomInt(0, 999999)})`;
}
