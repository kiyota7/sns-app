// シーディングスクリプト。ローカルのバックエンド(BASE_URL、既定は
// http://localhost:8080)に対して、実際のREST API経由でテストデータを投入する。
//
// 直接SQLiteにINSERTする方式ではなく、あえて本物のAPIを叩く方式にしている。
// 理由: BCryptハッシュの再現やFlywayスキーマへの追従をシーダー側で
// メンテナンし続けるコストの方が、登録リクエストのBCryptコスト(数百ユーザー分、
// 数十秒程度)より高くつくため。
//
// 実行方法: 直接 `k6 run seed.js` することも可能だが、k6 単体では
// 生成した「パワーユーザーID・バズ投稿ID」の一覧(seed-manifest.json)を
// ファイルに書き出せない(k6のサンドボックスはファイル書き込みをサポートしない)。
// そのため、標準出力に `SEED_MANIFEST_JSON:` で始まる1行としてJSONを出力し、
// 同ディレクトリの run-seed.sh がそれを拾って results/seed-manifest.json に
// 書き出す。**必ず `./run-seed.sh` (または `bash run-seed.sh`) 経由で実行すること。**
import { check } from 'k6';
import { assertLocalOnly, BASE_URL, SEED_PASSWORD } from '../config/environment.js';
import { postJson, postMultipart } from '../lib/http.js';
import { seededEmail, seededPowerUserEmail, registerOrLogin } from '../lib/auth.js';
import { randomInt, randomDistinctIndices, randomPostBody, randomCommentBody } from '../lib/data.js';
import * as cfg from './seed-config.js';

export const options = {
  scenarios: {
    seed: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30m',
    },
  },
  // シーディング自体は「特性計測」ではなく前準備なので、しきい値は
  // 極端な失敗(登録・投稿が全滅する等)だけ検知できれば十分。
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function createPost(user, body) {
  const res = postMultipart(BASE_URL, '/api/posts', user.accessToken, { body }, 'seed: create post');
  check(res, { 'seed: create post succeeded': (r) => r.status === 201 });
  return res.json().id;
}

function likePost(user, postId) {
  const res = postJson(BASE_URL, `/api/posts/${postId}/likes`, user.accessToken, {}, 'seed: like post');
  check(res, { 'seed: like succeeded': (r) => r.status === 200 });
}

function commentOnPost(user, postId) {
  const res = postJson(
    BASE_URL,
    `/api/posts/${postId}/comments`,
    user.accessToken,
    { body: randomCommentBody() },
    'seed: create comment'
  );
  check(res, { 'seed: comment succeeded': (r) => r.status === 201 });
}

function followUser(user, targetUserId) {
  const res = postJson(BASE_URL, `/api/users/${targetUserId}/follow`, user.accessToken, {}, 'seed: follow');
  check(res, { 'seed: follow succeeded': (r) => r.status === 200 });
}

export default function () {
  assertLocalOnly();

  console.log(
    `[perf-tests] seeding ${cfg.USER_COUNT} regular users + ${cfg.POWER_USER_COUNT} power users against ${BASE_URL} ...`
  );

  // --- 1. ユーザー登録(通常ユーザー) ---
  const users = []; // { id, username, accessToken, isPower, postIds: [] }
  for (let i = 1; i <= cfg.USER_COUNT; i++) {
    const username = `perf_user_${pad(i, 4)}`;
    const email = seededEmail(i);
    const auth = registerOrLogin(BASE_URL, username, email, SEED_PASSWORD);
    users.push({ id: auth.id, username, accessToken: auth.accessToken, isPower: false, postIds: [] });
    if (i % 10 === 0) console.log(`[perf-tests] registered ${i}/${cfg.USER_COUNT} regular users`);
  }

  // --- 2. ユーザー登録(パワーユーザー) ---
  const powerUsers = [];
  for (let i = 1; i <= cfg.POWER_USER_COUNT; i++) {
    const username = `perf_power_${pad(i, 2)}`;
    const email = seededPowerUserEmail(i);
    const auth = registerOrLogin(BASE_URL, username, email, SEED_PASSWORD);
    const user = { id: auth.id, username, accessToken: auth.accessToken, isPower: true, postIds: [] };
    users.push(user);
    powerUsers.push(user);
  }
  console.log(`[perf-tests] registered ${cfg.POWER_USER_COUNT} power users`);

  // --- 3. 投稿作成 ---
  // パワーユーザーの最初の投稿を「バズった投稿」とし、あとで大量のコメント・
  // いいねを集中させる。
  const viralPosts = []; // { postId, authorUsername }
  for (const user of users) {
    const min = user.isPower ? cfg.POWER_USER_MIN_POSTS : cfg.MIN_POSTS_PER_USER;
    const max = user.isPower ? cfg.POWER_USER_MAX_POSTS : cfg.MAX_POSTS_PER_USER;
    const postCount = randomInt(min, max);
    for (let p = 0; p < postCount; p++) {
      const postId = createPost(user, randomPostBody());
      user.postIds.push(postId);
      if (user.isPower && p === 0) {
        viralPosts.push({ postId, authorUsername: user.username, authorId: user.id });
      }
    }
    if (user.isPower) {
      console.log(`[perf-tests] ${user.username}: created ${postCount} posts (viral post id=${user.postIds[0]})`);
    }
  }
  console.log(`[perf-tests] created ${users.reduce((sum, u) => sum + u.postIds.length, 0)} posts total`);

  // --- 4. 通常投稿へのコメント・いいね ---
  for (const user of users) {
    for (const postId of user.postIds) {
      const commentCount = randomInt(cfg.MIN_COMMENTS_PER_POST, cfg.MAX_COMMENTS_PER_POST);
      for (let c = 0; c < commentCount; c++) {
        const commenter = users[randomInt(0, users.length - 1)];
        commentOnPost(commenter, postId);
      }

      const likeCount = randomInt(cfg.MIN_LIKES_PER_POST, cfg.MAX_LIKES_PER_POST);
      const likerIndices = randomDistinctIndices(users.length, likeCount);
      for (const idx of likerIndices) {
        likePost(users[idx], postId);
      }
    }
  }
  console.log('[perf-tests] finished seeding comments/likes for regular posts');

  // --- 5. バズった投稿への大量コメント・いいね ---
  for (const viral of viralPosts) {
    for (let c = 0; c < cfg.VIRAL_POST_COMMENT_COUNT; c++) {
      const commenter = users[c % users.length];
      commentOnPost(commenter, viral.postId);
    }
    const likerIndices = randomDistinctIndices(users.length, cfg.VIRAL_POST_LIKE_COUNT);
    for (const idx of likerIndices) {
      likePost(users[idx], viral.postId);
    }
    console.log(
      `[perf-tests] viral post ${viral.postId} (by ${viral.authorUsername}): ` +
        `${cfg.VIRAL_POST_COMMENT_COUNT} comments, ${likerIndices.length} likes`
    );
  }

  // --- 6. フォローグラフ ---
  for (const user of users) {
    const followCount = randomInt(cfg.MIN_FOLLOWS_PER_USER, cfg.MAX_FOLLOWS_PER_USER);
    const targetIndices = randomDistinctIndices(users.length, followCount + 1); // +1 は自分自身を除外する分の余裕
    let followed = 0;
    for (const idx of targetIndices) {
      if (followed >= followCount) break;
      const target = users[idx];
      if (target.id === user.id) continue; // 自分自身はフォローしない
      followUser(user, target.id);
      followed++;
    }
  }
  console.log('[perf-tests] finished building follow graph');

  // --- 7. マニフェスト出力 ---
  // 「パワーユーザーの最も投稿数が多い1人」を unbounded-results.js の
  // GET /api/users/{id}/posts ターゲットとして選ぶ。
  const busiestPowerUser = powerUsers.reduce((best, u) =>
    u.postIds.length > (best ? best.postIds.length : -1) ? u : best, null);

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    userCount: cfg.USER_COUNT,
    powerUserCount: cfg.POWER_USER_COUNT,
    seedPassword: SEED_PASSWORD,
    allUserIds: users.map((u) => u.id),
    viralPosts: viralPosts.map((v) => ({ postId: v.postId, authorId: v.authorId, authorUsername: v.authorUsername })),
    busiestPowerUser: busiestPowerUser
      ? { id: busiestPowerUser.id, username: busiestPowerUser.username, postCount: busiestPowerUser.postIds.length }
      : null,
    sampleRegularUserEmails: users.filter((u) => !u.isPower).slice(0, 5).map((u) => seededEmail(Number(u.username.split('_')[2]))),
  };

  console.log('[perf-tests] seeding complete.');
  console.log('SEED_MANIFEST_JSON:' + JSON.stringify(manifest));
}
