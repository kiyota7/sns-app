const STORAGE_KEY = 'sns-auth'

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

async function logout() {
  const auth = loadAuth()
  if (auth) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      })
    } catch {
      // ネットワークエラー等でもクライアント側のログイン状態は必ずクリアする
    }
  }
  clearAuth()
}

export const auth = {
  register,
  login,
  logout,
  getUser,
  getAccessToken,
  isLoggedIn: () => getAccessToken() !== null,
}
