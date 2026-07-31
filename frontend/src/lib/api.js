const STORAGE_KEY = 'sns-auth'

export class AuthExpiredError extends Error {
  constructor() {
    super('認証の有効期限が切れました。再度ログインしてください。')
    this.name = 'AuthExpiredError'
  }
}

function loadAuth() {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

function saveAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

function getUser() {
  return loadAuth()?.user ?? null
}

function getAccessToken() {
  return loadAuth()?.accessToken ?? null
}

async function parseErrorMessage(response) {
  try {
    const body = await response.json()
    return body.error ?? '予期しないエラーが発生しました。'
  } catch {
    return '予期しないエラーが発生しました。'
  }
}

async function register({ username, email, password }) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  const auth = await response.json()
  saveAuth(auth)
  return auth
}

async function login({ email, password }) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  const auth = await response.json()
  saveAuth(auth)
  return auth
}

// リフレッシュトークンを使ってアクセストークン・リフレッシュトークンを再発行する。
// 成功時は新しいトークンの組を保存し直す(ユーザー情報はそのまま維持する)。
async function refresh() {
  const current = loadAuth()
  if (!current?.refreshToken) {
    clearAuth()
    throw new AuthExpiredError()
  }

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
  if (!response.ok) {
    clearAuth()
    throw new AuthExpiredError()
  }

  const { accessToken, refreshToken } = await response.json()
  saveAuth({ accessToken, refreshToken, user: current.user })
  return accessToken
}

// 認証付きAPIリクエスト用の共通ラッパー。Authorizationヘッダーを自動で付与し、
// アクセストークンが失効している(401)場合はリフレッシュを1回試みてからリトライする。
async function authFetch(url, options = {}) {
  const requestWith = (token) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    })

  let accessToken = getAccessToken()
  if (!accessToken) {
    throw new AuthExpiredError()
  }

  let response = await requestWith(accessToken)

  if (response.status === 401) {
    accessToken = await refresh()
    response = await requestWith(accessToken)
  }

  return response
}

async function me() {
  const response = await authFetch('/api/auth/me')
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  const user = await response.json()
  const current = loadAuth()
  if (current) {
    saveAuth({ ...current, user })
  }
  return user
}

async function logout() {
  const current = loadAuth()
  if (current) {
    try {
      await authFetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      })
    } catch {
      // ネットワークエラー・トークン失効等でもクライアント側のログイン状態は必ずクリアする
    }
  }
  clearAuth()
}

export const auth = {
  register,
  login,
  logout,
  refresh,
  me,
  getUser,
  getAccessToken,
  isLoggedIn: () => getAccessToken() !== null,
}

async function listPosts() {
  const response = await authFetch('/api/posts')
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function createPost({ body, image }) {
  const formData = new FormData()
  formData.append('body', body)
  if (image) {
    formData.append('image', image)
  }
  const response = await authFetch('/api/posts', {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function updatePost(id, { body }) {
  const response = await authFetch(`/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function deletePost(id) {
  const response = await authFetch(`/api/posts/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
}

async function getPostById(id) {
  const response = await authFetch(`/api/posts/${id}`)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function toggleLike(id) {
  const response = await authFetch(`/api/posts/${id}/likes`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

export const posts = {
  list: listPosts,
  create: createPost,
  update: updatePost,
  remove: deletePost,
  getById: getPostById,
  toggleLike,
}

async function listComments(postId) {
  const response = await authFetch(`/api/posts/${postId}/comments`)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function createComment(postId, { body }) {
  const response = await authFetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

export const comments = {
  list: listComments,
  create: createComment,
}

async function getProfile(id) {
  const response = await authFetch(`/api/users/${id}`)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function getUserPosts(id) {
  const response = await authFetch(`/api/users/${id}/posts`)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function updateProfile({ username, bio }) {
  const response = await authFetch('/api/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, bio }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function toggleFollow(id) {
  const response = await authFetch(`/api/users/${id}/follow`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

export const users = {
  getProfile,
  getPosts: getUserPosts,
  updateProfile,
  toggleFollow,
}
