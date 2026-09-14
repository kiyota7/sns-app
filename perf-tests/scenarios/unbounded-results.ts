// unbounded-results.ts: ページネーションが無いエンドポイントの負荷テスト。
//
// GET /api/posts/{postId}/comments (CommentMapper.findByPostIdOrderByCreatedAtDesc)
// と GET /api/users/{id}/posts (PostMapper.findByUserIdOrderByCreatedAtDesc) は
// どちらもLIMIT句が無く、対象データを全件返す。かつ posts.user_id /
// comments.post_id に二次インデックスも無い。データ量がほぼ空のDBでは
// 問題にならないため、seed.ts が作る「バズった投稿(大量コメント)」
// 「最も投稿数の多いパワーユーザー」を固定ターゲットにして負荷をかけ、
// レイテンシとレスポンスサイズの両方を計測する。
//
// 事前に `perf-tests/seed/run-seed.sh` でシード投入しておくこと。
//
// 実行: k6 run perf-tests/scenarios/unbounded-results.ts
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { assertLocalOnly, BASE_URL } from '../config/environment.ts';
import { getJson } from '../lib/http.ts';
import { loginAsSeededUser, Session } from '../lib/auth.ts';
import { requireManifest } from '../lib/data.ts';

const manifest = requireManifest();
if (!manifest.viralPosts || manifest.viralPosts.length === 0 || !manifest.busiestPowerUser) {
  throw new Error('[perf-tests] seed-manifest.json に必要なターゲットがありません。seedingをやり直してください。');
}
const viralPost = manifest.viralPosts[0];
const busiestUserId = manifest.busiestPowerUser.id;

const commentsResponseBytes = new Trend('unbounded_comments_response_bytes');
const userPostsResponseBytes = new Trend('unbounded_user_posts_response_bytes');

const TARGET_VUS = Number(__ENV.VUS) || 10;
const DURATION = __ENV.DURATION || '1m';

export const options = {
  scenarios: {
    unbounded_results: {
      executor: 'constant-vus',
      vus: TARGET_VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    'http_req_duration{name:GET /api/posts/:id/comments (unbounded)}': ['p(95)<1500'],
    'http_req_duration{name:GET /api/users/:id/posts (unbounded)}': ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup(): void {
  assertLocalOnly();
}

let session: Session | null = null;

function ensureSession(): Session {
  if (!session) {
    session = loginAsSeededUser(BASE_URL, manifest.userCount);
  }
  return session;
}

export default function (): void {
  const { accessToken } = ensureSession();

  if (__ITER % 2 === 0) {
    const res = getJson(
      BASE_URL,
      `/api/posts/${viralPost.postId}/comments`,
      accessToken,
      'GET /api/posts/:id/comments (unbounded)'
    );
    check(res, { 'comments(unbounded): status 200': (r) => r.status === 200 });
    if (res.body) commentsResponseBytes.add(res.body.length);
  } else {
    const res = getJson(
      BASE_URL,
      `/api/users/${busiestUserId}/posts`,
      accessToken,
      'GET /api/users/:id/posts (unbounded)'
    );
    check(res, { 'user posts(unbounded): status 200': (r) => r.status === 200 });
    if (res.body) userPostsResponseBytes.add(res.body.length);
  }

  sleep(1);
}
