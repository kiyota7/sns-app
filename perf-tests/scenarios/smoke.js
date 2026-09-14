// smoke.js: 疎通確認用の最小構成テスト。
//
// 目的は「これから重い負荷テストを実行して大丈夫か」の事前チェックであり、
// レイテンシの特性を見るものではない。そのためシード投入(seed.js)を
// 前提とせず、実行のたびに専用のテストユーザーを1人登録して使う。
//
// 実行: k6 run perf-tests/scenarios/smoke.js
import { check, sleep } from 'k6';
import { assertLocalOnly, BASE_URL } from '../config/environment.js';
import { postJson, getJson, postMultipart, deleteReq } from '../lib/http.js';
import { registerOrLogin } from '../lib/auth.js';
import { randomPostBody, randomCommentBody } from '../lib/data.js';

export const options = {
  vus: Number(__ENV.VUS) || 2,
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export function setup() {
  assertLocalOnly();
}

export default function () {
  const username = `perf_smoke_${__VU}_${Date.now()}`;
  const email = `${username}@perf.test`;
  const auth = registerOrLogin(BASE_URL, username, email, 'Password123!');
  const token = auth.accessToken;

  check(getJson(BASE_URL, '/api/auth/me', token, 'GET /api/auth/me'), {
    'me: status 200': (r) => r.status === 200,
  });

  check(getJson(BASE_URL, '/api/posts?scope=all&limit=5', token, 'GET /api/posts'), {
    'timeline: status 200': (r) => r.status === 200,
  });

  const createRes = postMultipart(BASE_URL, '/api/posts', token, { body: randomPostBody() }, 'POST /api/posts');
  const created = check(createRes, { 'create post: status 201': (r) => r.status === 201 });
  if (!created) {
    sleep(1);
    return;
  }
  const postId = createRes.json().id;

  check(getJson(BASE_URL, `/api/posts/${postId}`, token, 'GET /api/posts/:id'), {
    'get post: status 200': (r) => r.status === 200,
  });

  check(postJson(BASE_URL, `/api/posts/${postId}/likes`, token, {}, 'POST /api/posts/:id/likes'), {
    'like: status 200': (r) => r.status === 200,
  });

  check(
    postJson(BASE_URL, `/api/posts/${postId}/comments`, token, { body: randomCommentBody() }, 'POST /api/posts/:id/comments'),
    { 'comment: status 201': (r) => r.status === 201 }
  );

  check(deleteReq(BASE_URL, `/api/posts/${postId}`, token, 'DELETE /api/posts/:id'), {
    'delete post: status 204': (r) => r.status === 204,
  });

  sleep(1);
}
