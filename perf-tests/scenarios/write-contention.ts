// write-contention.ts: SQLite単一ライター特性を狙い撃ちする、このアプリ特有の
// シナリオ。
//
// 同じ「バズった投稿」へのいいね/コメント、同じパワーユーザーへのフォローを
// 複数VUで同時に叩くことで、SQLiteの書き込みロック競合(SQLITE_BUSY)や
// Hikariのプール待ち(既定 connectionTimeout=30秒)が実際にどう表面化するかを
// 計測する。
//
// このシナリオは「エラーが出ないこと」を検証するものではなく、
// 「エラー・レイテンシ悪化がどの程度・どんな形で出るか」を特性として
// 可視化するためのもの。500(GlobalExceptionHandlerのcatch-all、
// body={"error":"予期しないエラーが発生しました。"})が一定数出ることは
// SQLiteの制約上ある程度想定内であり、しきい値もそれを踏まえて緩めに設定している。
//
// 事前に `perf-tests/seed/run-seed.sh` でシード投入しておくこと。
//
// 実行: k6 run perf-tests/scenarios/write-contention.ts
//       VUS=25 DURATION=2m k6 run perf-tests/scenarios/write-contention.ts
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { assertLocalOnly, BASE_URL } from '../config/environment.ts';
import { postJson, K6Response } from '../lib/http.ts';
import { loginAsSeededUser, Session } from '../lib/auth.ts';
import { requireManifest, weightedPick, randomCommentBody } from '../lib/data.ts';

const manifest = requireManifest();
if (!manifest.viralPosts || manifest.viralPosts.length === 0) {
  throw new Error('[perf-tests] seed-manifest.json に viralPosts がありません。seedingをやり直してください。');
}
const viralPost = manifest.viralPosts[0];
const followTargetUserId = manifest.busiestPowerUser ? manifest.busiestPowerUser.id : viralPost.authorId;

const serverErrors = new Counter('write_server_errors'); // status >= 500 の件数(エンドポイント別にtagで内訳を見る)

const TARGET_VUS = Number(__ENV.VUS) || 15;
const DURATION = __ENV.DURATION || '1m';

export const options = {
  scenarios: {
    write_contention: {
      executor: 'constant-vus',
      // ランプアップせず、最初から同時実行数を叩きつける
      // (書き込み競合をわざと起こすのが目的のため)。
      vus: TARGET_VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    // 通常の失敗率しきい値ではなく、「チェック合格率」を主指標にする。
    // checks は「status < 500」を見ているので、ある程度の500発生は許容しつつ、
    // 大部分は成功することを確認する。
    checks: ['rate>0.90'],
    'http_req_duration{name:POST /api/posts/:id/likes}': ['p(95)<2000'],
    'http_req_duration{name:POST /api/users/:id/follow}': ['p(95)<2000'],
    'http_req_duration{name:POST /api/posts/:id/comments}': ['p(95)<2000'],
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

function recordOutcome(res: K6Response, endpointTag: string): boolean {
  const ok = check(res, { [`${endpointTag}: status < 500`]: (r) => r.status < 500 });
  if (res.status >= 500) {
    serverErrors.add(1, { endpoint: endpointTag });
  }
  return ok;
}

type Action = 'like' | 'follow' | 'comment';

export default function (): void {
  const { accessToken } = ensureSession();

  const action = weightedPick<Action>([
    ['like', 0.5],
    ['follow', 0.3],
    ['comment', 0.2],
  ]);

  if (action === 'like') {
    const res = postJson(BASE_URL, `/api/posts/${viralPost.postId}/likes`, accessToken, {}, 'POST /api/posts/:id/likes');
    recordOutcome(res, 'like');
  } else if (action === 'follow') {
    const res = postJson(
      BASE_URL,
      `/api/users/${followTargetUserId}/follow`,
      accessToken,
      {},
      'POST /api/users/:id/follow'
    );
    recordOutcome(res, 'follow');
  } else {
    const res = postJson(
      BASE_URL,
      `/api/posts/${viralPost.postId}/comments`,
      accessToken,
      { body: randomCommentBody() },
      'POST /api/posts/:id/comments'
    );
    recordOutcome(res, 'comment');
  }

  // sleepを入れすぎるとVU間のリクエストが自然にばらけて「同時書き込み」を
  // 再現しにくくなるため、ごく短くする。
  sleep(0.1);
}
