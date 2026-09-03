import type { Comment, FollowResult, LikeResult, Post, Profile, StoredAuth, User, UserSearchResult } from './types'

const STORAGE_KEY = 'sns-auth'

export class AuthExpiredError extends Error {
  constructor() {
    super('認証の有効期限が切れました。再度ログインしてください。')
    this.name = 'AuthExpiredError'
  }
}

function loadAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

function saveAuth(auth: StoredAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function getUser(): User | null {
  return loadAuth()?.user ?? null
}

function getAccessToken(): string | null {
  return loadAuth()?.accessToken ?? null
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return body.error ?? '予期しないエラーが発生しました。'
  } catch {
    return '予期しないエラーが発生しました。'
  }
}

interface Credentials {
  username?: string
  email: string
  password: string
}

async function register({ username, email, password }: Required<Credentials>): Promise<StoredAuth> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  const auth: StoredAuth = await response.json()
  saveAuth(auth)
  return auth
}

async function login({ email, password }: Pick<Credentials, 'email' | 'password'>): Promise<StoredAuth> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  const auth: StoredAuth = await response.json()
  saveAuth(auth)
  return auth
}

// リフレッシュトークンを使ってアクセストークン・リフレッシュトークンを再発行する。
// 成功時は新しいトークンの組を保存し直す(ユーザー情報はそのまま維持する)。
async function refresh(): Promise<string> {
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

  const { accessToken, refreshToken }: { accessToken: string; refreshToken: string } = await response.json()
  saveAuth({ accessToken, refreshToken, user: current.user })
  return accessToken
}

// 認証付きAPIリクエスト用の共通ラッパー。Authorizationヘッダーを自動で付与し、
// アクセストークンが失効している(401)場合はリフレッシュを1回試みてからリトライする。
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const requestWith = (token: string) =>
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

async function me(): Promise<User> {
  const response = await authFetch('/api/auth/me')
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  const user: User = await response.json()
  const current = loadAuth()
  if (current) {
    saveAuth({ ...current, user })
  }
  return user
}

async function logout(): Promise<void> {
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

async function listPosts({ scope }: { scope?: string } = {}): Promise<Post[]> {
  const url = scope ? `/api/posts?scope=${encodeURIComponent(scope)}` : '/api/posts'
  const response = await authFetch(url)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function createPost({ body, image }: { body: string; image?: File | null }): Promise<Post> {
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

async function updatePost(id: number, { body }: { body: string }): Promise<Post> {
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

async function deletePost(id: number): Promise<void> {
  const response = await authFetch(`/api/posts/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
}

async function getPostById(id: number | string): Promise<Post> {
  const response = await authFetch(`/api/posts/${id}`)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function toggleLike(id: number): Promise<LikeResult> {
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

async function listComments(postId: number | string): Promise<Comment[]> {
  const response = await authFetch(`/api/posts/${postId}/comments`)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function createComment(postId: number | string, { body }: { body: string }): Promise<Comment> {
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

async function getProfile(id: number | string): Promise<Profile> {
  const response = await authFetch(`/api/users/${id}`)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function getUserPosts(id: number | string): Promise<Post[]> {
  const response = await authFetch(`/api/users/${id}/posts`)
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function updateProfile({
  username,
  bio,
  avatar,
}: {
  username: string
  bio?: string
  avatar?: File | null
}): Promise<Profile> {
  const formData = new FormData()
  formData.append('username', username)
  formData.append('bio', bio ?? '')
  if (avatar) {
    formData.append('avatar', avatar)
  }
  const response = await authFetch('/api/users/me', {
    method: 'PUT',
    body: formData,
  })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function toggleFollow(id: number): Promise<FollowResult> {
  const response = await authFetch(`/api/users/${id}/follow`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }
  return response.json()
}

async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const response = await authFetch(`/api/users?query=${encodeURIComponent(query)}`)
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
  search: searchUsers,
}
