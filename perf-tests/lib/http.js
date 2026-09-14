// http.* の薄いラッパー。すべてのリクエストに `tags: { name: ... }` を付けて、
// k6のサマリー/JSON出力で `http_req_duration{name:...}` のようにエンドポイント別に
// 集計できるようにする(name を付けないと、動的パス(/api/posts/123 等)が
// 別々のURLとして扱われ、統計がエンドポイントごとに分散してしまう)。
import http from 'k6/http';

function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function getJson(baseUrl, path, token, name) {
  return http.get(`${baseUrl}${path}`, {
    headers: jsonHeaders(token),
    tags: { name: name || path },
  });
}

export function postJson(baseUrl, path, token, body, name) {
  return http.post(`${baseUrl}${path}`, JSON.stringify(body), {
    headers: jsonHeaders(token),
    tags: { name: name || path },
  });
}

export function putJson(baseUrl, path, token, body, name) {
  return http.put(`${baseUrl}${path}`, JSON.stringify(body), {
    headers: jsonHeaders(token),
    tags: { name: name || path },
  });
}

export function deleteReq(baseUrl, path, token, name) {
  return http.del(`${baseUrl}${path}`, null, {
    headers: jsonHeaders(token),
    tags: { name: name || path },
  });
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
function buildMultipartBody(fields) {
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

export function postMultipart(baseUrl, path, token, fields, name) {
  const { body, contentType } = buildMultipartBody(fields);
  const headers = { 'Content-Type': contentType };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return http.post(`${baseUrl}${path}`, body, {
    headers,
    tags: { name: name || path },
  });
}

export function putMultipart(baseUrl, path, token, fields, name) {
  const { body, contentType } = buildMultipartBody(fields);
  const headers = { 'Content-Type': contentType };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return http.put(`${baseUrl}${path}`, body, {
    headers,
    tags: { name: name || path },
  });
}
