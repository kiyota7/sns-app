// baseline-read.ts: 読み取り中心の負荷テスト。
//
// タイムライン閲覧・プロフィール閲覧・ユーザー検索など、実際のSNS利用で
// 最も頻度の高い「読み取り」操作を重み付きで混ぜて実行し、読み取りパスの
// レイテンシ/スループットのベースラインを確立する。
//
// 事前に `perf-tests/seed/run-seed.sh` でシード投入しておくこと。
//
// 実行: k6 run perf-tests/scenarios/baseline-read.ts
//       VUS=30 DURATION=3m k6 run perf-tests/scenarios/baseline-read.ts
import { check, sleep } from 'k6';
import { assertLocalOnly, BASE_URL } from '../config/environment.ts';
import { getJson, K6Response } from '../lib/http.ts';
import { loginAsSeededUser, Session } from '../lib/auth.ts';
import { requireManifest, randomInt, weightedPick } from '../lib/data.ts';

const manifest = requireManifest();

const TARGET_VUS = Number(__ENV.VUS) || 20;
const HOLD_DURATION = __ENV.DURATION || '2m';

export const options = {
  scenarios: {
    baseline_read: {
      executor: 'ramping-vus',
      startVUs: 0,
      // 全VUがいきなりログインに殺到しないよう、20秒かけて立ち上げる。
      stages: [
        { duration: '20s', target: TARGET_VUS },
        { duration: HOLD_DURATION, target: TARGET_VUS },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    // 以下はt3.micro相当のローカル環境向けの初期値。初回実行の結果を見て
    // README記載の手順でプロジェクトの実情に合わせて調整すること。
    'http_req_duration{name:GET /api/posts}': ['p(95)<400', 'p(99)<800'],
    'http_req_duration{name:GET /api/users search}': ['p(95)<600'], // LIKE '%...%' で全表走査になるため緩め
    http_req_failed: ['rate<0.01'],
  },
};

// VUごとに一度だけログインし、以降のイテレーションで使い回す
// (毎イテレーション再ログインするとBCryptコストが支配的になり、
// 読み取りパスの純粋な計測にならないため)。
let session: Session | null = null;

function ensureSession(): Session {
  if (!session) {
    session = loginAsSeededUser(BASE_URL, manifest.userCount);
  }
  return session;
}

function browseTimelineAll(token: string): K6Response {
  const res = getJson(BASE_URL, '/api/posts?scope=all&limit=20', token, 'GET /api/posts');
  check(res, { 'timeline(all): status 200': (r) => r.status === 200 });
  return res;
}

function browseTimelineFollowing(token: string): void {
  let cursor: number | null = null;
  for (let page = 0; page < 3; page++) {
    const path = cursor
      ? `/api/posts?scope=following&limit=20&cursor=${cursor}`
      : '/api/posts?scope=following&limit=20';
    const res = getJson(BASE_URL, path, token, 'GET /api/posts (following)');
    const ok = check(res, { 'timeline(following): status 200': (r) => r.status === 200 });
    if (!ok) break;
    const body = res.json() as { items: { id: number }[]; hasMore: boolean };
    if (!body.hasMore || body.items.length === 0) break;
    cursor = body.items[body.items.length - 1].id;
  }
}

function viewRandomProfile(token: string): void {
  const userId = manifest.allUserIds[randomInt(0, manifest.allUserIds.length - 1)];
  const res = getJson(BASE_URL, `/api/users/${userId}`, token, 'GET /api/users/:id');
  check(res, { 'profile: status 200': (r) => r.status === 200 });
}

function searchUsers(token: string): void {
  // 既知のシード済みユーザー名に部分一致する接頭辞と、ヒットしにくい1文字を
  // 混ぜることで、ヒットあり/なし両方のクエリパターンを再現する。
  const prefixes = ['perf_user_0', 'perf_power_0', 'perf_user_1', 'a', 'e'];
  const q = prefixes[randomInt(0, prefixes.length - 1)];
  const res = getJson(BASE_URL, `/api/users?query=${encodeURIComponent(q)}`, token, 'GET /api/users search');
  check(res, { 'search: status 200': (r) => r.status === 200 });
}

function viewRandomPostDetail(token: string): void {
  const res = browseTimelineAll(token);
  if (res.status !== 200) return;
  const items = (res.json() as { items: { id: number }[] }).items;
  if (items.length === 0) return;
  const postId = items[randomInt(0, items.length - 1)].id;
  const detail = getJson(BASE_URL, `/api/posts/${postId}`, token, 'GET /api/posts/:id');
  check(detail, { 'post detail: status 200': (r) => r.status === 200 });
}

type Action = 'timeline_all' | 'timeline_following' | 'profile' | 'search' | 'post_detail';

export function setup(): void {
  assertLocalOnly();
}

export default function (): void {
  const { accessToken } = ensureSession();

  const action = weightedPick<Action>([
    ['timeline_all', 0.4],
    ['timeline_following', 0.2],
    ['profile', 0.2],
    ['search', 0.1],
    ['post_detail', 0.1],
  ]);

  switch (action) {
    case 'timeline_all':
      browseTimelineAll(accessToken);
      break;
    case 'timeline_following':
      browseTimelineFollowing(accessToken);
      break;
    case 'profile':
      viewRandomProfile(accessToken);
      break;
    case 'search':
      searchUsers(accessToken);
      break;
    case 'post_detail':
      viewRandomPostDetail(accessToken);
      break;
  }

  sleep(randomInt(1, 3));
}
