// ログイン・トークン管理のヘルパー。
//
// アクセストークンは15分で失効するため(app.jwt.access-expiration-ms)、
// 1分程度の短いシナリオでは基本的に再ログイン不要。ただし将来 soak.ts 等で
// 長時間実行する場合に備えて refreshAccessToken() を用意してある。
import { check } from 'k6';
import { postJson } from './http.ts';
import { SEED_PASSWORD } from '../config/environment.ts';

export interface Session {
  id: number;
  accessToken: string;
  refreshToken: string;
}

interface AuthResponseBody {
  accessToken: string;
  refreshToken: string;
  user: { id: number; username: string; email: string; bio: string | null };
}

interface RefreshResponseBody {
  accessToken: string;
  refreshToken: string;
}

// seed.ts と命名規則を合わせること。ここを変更したら seed/seed-config.ts も揃える。
export function seededEmail(index: number): string {
  return `perf_user_${String(index).padStart(4, '0')}@perf.test`;
}

export function seededPowerUserEmail(index: number): string {
  return `perf_power_${String(index).padStart(2, '0')}@perf.test`;
}

export function registerUser(baseUrl: string, username: string, email: string, password: string) {
  const res = postJson(baseUrl, '/api/auth/register', null, { username, email, password }, 'POST /api/auth/register');
  check(res, { 'register: status is 201 or 409 (already exists)': (r) => r.status === 201 || r.status === 409 });
  return res;
}

export function login(baseUrl: string, email: string, password: string): Session {
  const res = postJson(baseUrl, '/api/auth/login', null, { email, password }, 'POST /api/auth/login');
  const ok = check(res, { 'login: status is 200': (r) => r.status === 200 });
  if (!ok) {
    throw new Error(`[perf-tests] login failed for ${email}: status=${res.status} body=${res.body}`);
  }
  const json = res.json() as AuthResponseBody;
  return {
    id: json.user.id,
    accessToken: json.accessToken,
    refreshToken: json.refreshToken,
  };
}

// 登録を試み、既に存在する場合(409)はログインしてトークンを取得する。
// seed.ts を(reset-db.sh を挟まずに)再実行しても壊れないようにするための
// 冪等化ヘルパー。
export function registerOrLogin(baseUrl: string, username: string, email: string, password: string): Session {
  const res = postJson(baseUrl, '/api/auth/register', null, { username, email, password }, 'POST /api/auth/register');
  if (res.status === 201) {
    const json = res.json() as AuthResponseBody;
    return { id: json.user.id, accessToken: json.accessToken, refreshToken: json.refreshToken };
  }
  if (res.status === 409) {
    return login(baseUrl, email, password);
  }
  throw new Error(`[perf-tests] registerOrLogin failed for ${email}: status=${res.status} body=${res.body}`);
}

// VUごとに、シード済みユーザーをラウンドロビンでログインして
// { accessToken, refreshToken, id } を返す。全VUが同じユーザーに
// ログインし続けると意味が薄れるため、__VU で割り振る。
export function loginAsSeededUser(baseUrl: string, userCount: number): Session {
  const index = ((__VU - 1) % userCount) + 1;
  return login(baseUrl, seededEmail(index), SEED_PASSWORD);
}

export function refreshAccessToken(baseUrl: string, refreshToken: string): { accessToken: string; refreshToken: string } {
  const res = postJson(baseUrl, '/api/auth/refresh', null, { refreshToken }, 'POST /api/auth/refresh');
  check(res, { 'refresh: status is 200': (r) => r.status === 200 });
  const json = res.json() as RefreshResponseBody;
  return { accessToken: json.accessToken, refreshToken: json.refreshToken };
}
