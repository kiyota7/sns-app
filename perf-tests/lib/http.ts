// http.* の薄いラッパー。すべてのリクエストに `tags: { name: ... }` を付けて、
// k6のサマリー/JSON出力で `http_req_duration{name:...}` のようにエンドポイント別に
// 集計できるようにする(name を付けないと、動的パス(/api/posts/123 等)が
// 別々のURLとして扱われ、統計がエンドポイントごとに分散してしまう)。
import http from 'k6/http';

// k6は公式の型宣言パッケージを別途インストールしない限りResponse型を
// import type できないため、このファイルで実際に使うプロパティだけを
// 持つ最小限の型をここで定義している(k6実行時には型注釈自体が
// 取り除かれるため、実体には影響しない)。
export interface K6Response {
  status: number;
  body: string | null;
  json(): any;
}

type QueryValue = string | number | boolean | undefined | null;
export type MultipartFields = Record<string, QueryValue>;

function jsonHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function getJson(baseUrl: string, path: string, token?: string | null, name?: string): K6Response {
  return http.get(`${baseUrl}${path}`, {
    headers: jsonHeaders(token),
    tags: { name: name || path },
  }) as unknown as K6Response;
}

export function postJson(
  baseUrl: string,
  path: string,
  token: string | null | undefined,
  body: unknown,
  name?: string
): K6Response {
  return http.post(`${baseUrl}${path}`, JSON.stringify(body), {
    headers: jsonHeaders(token),
    tags: { name: name || path },
  }) as unknown as K6Response;
}

export function putJson(
  baseUrl: string,
  path: string,
  token: string | null | undefined,
  body: unknown,
  name?: string
): K6Response {
  return http.put(`${baseUrl}${path}`, JSON.stringify(body), {
    headers: jsonHeaders(token),
    tags: { name: name || path },
  }) as unknown as K6Response;
}

export function deleteReq(baseUrl: string, path: string, token?: string | null, name?: string): K6Response {
  return http.del(`${baseUrl}${path}`, null, {
    headers: jsonHeaders(token),
    tags: { name: name || path },
  }) as unknown as K6Response;
}

// multipart/form-data 用(POST /api/posts, PUT /api/users/me)。
//
// 注意: k6は body オブジェクトに http.file(...) が含まれる場合のみ自動で
// multipart/form-data にエンコードし、文字列フィールドだけの場合は
// application/x-www-form-urlencoded にしてしまう(Content-Type ヘッダーを
// こちらで 'multipart/form-data' と明示しても、実際のボディはurlencodedの
// ままになり、boundaryも付かない)。このアプリのControllerは画像なしでも
// consumes = MULTIPART_FORM_DATA_VALUE を要求するため、ファイルパートが
// 無い場合でも常に正しいmultipartボディをこちらで組み立てて送る。
function buildMultipartBody(fields: MultipartFields): { body: string; contentType: string } {
  const boundary = `----k6perf${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  let body = '';
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

export function postMultipart(
  baseUrl: string,
  path: string,
  token: string | null | undefined,
  fields: MultipartFields,
  name?: string
): K6Response {
  const { body, contentType } = buildMultipartBody(fields);
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return http.post(`${baseUrl}${path}`, body, {
    headers,
    tags: { name: name || path },
  }) as unknown as K6Response;
}

export function putMultipart(
  baseUrl: string,
  path: string,
  token: string | null | undefined,
  fields: MultipartFields,
  name?: string
): K6Response {
  const { body, contentType } = buildMultipartBody(fields);
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return http.put(`${baseUrl}${path}`, body, {
    headers,
    tags: { name: name || path },
  }) as unknown as K6Response;
}
