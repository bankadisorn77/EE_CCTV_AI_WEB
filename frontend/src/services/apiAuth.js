// Vite uses import.meta.env instead of process.env
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api'

// ── Helper: parse error message from response ──
async function parseError(response) {
  try {
    const data = await response.json()
    return data?.message || data?.error || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

// ── Helper: build auth headers ──
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
  }
}

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────
export const login = async ({ en, password }) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ en, password }),
  })

  if (!response.ok) {
    const msg = await parseError(response)
    throw new Error(msg)
  }

  const data = await response.json()
  sessionStorage.setItem('token', data.accessToken)
  sessionStorage.setItem('refreshToken', data.refreshToken)
  return data
}

// ─────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────
export const authRegister = async ({ en, password, role, plant }) => {
  // console.log('Registering user with:', { en, role, plant })  // Debug log
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
    },
    body: JSON.stringify({ en, password, role, plant }),
  })

  if (!response.ok) {
    const msg = await parseError(response)
    throw new Error(msg)
  }

  return response.json()
}

// ─────────────────────────────────────────────
// Refresh Token
// ─────────────────────────────────────────────
export const refreshToken = async () => {
  const refresh_token = sessionStorage.getItem('refreshToken');
  const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh_token }),
  })

  if (!response.ok) {
    // Token is invalid/expired — force logout
    logout()
    throw new Error('Session expired. Please log in again.')
  }

  const data = await response.json()
  sessionStorage.setItem('token', data.accessToken)
  return data
}

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────
export const logout = () => {
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('refreshToken')
}

// ─────────────────────────────────────────────
// Get stored token
// ─────────────────────────────────────────────
export const getToken = () => {
  const token = sessionStorage.getItem('token');
  //verify expired token
//   {
//   "id": 1,
//   "en": "admin",
//   "role": "admin",
//   "plant": "ALL",
//   "iat": 1772444637,
//   "exp": 1772445537
// }
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        // ปล่อยให้ Access Token หมดอายุทะลุไป เพื่อให้ Axios Interceptor ทำหน้าที่เรียก refreshToken เอง
      }
      return token
    } catch {
      return null
    }
  }
  return null
}

// ─────────────────────────────────────────────
// Decode JWT (for role/plant info if needed)
// ─────────────────────────────────────────────
export const decodeToken = () => { 
  try {
    const token = getToken()
    if (!token) return null
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
    
  } catch {
    return null
  }
}



export const isAuthenticated = () => {
  return !!getToken()
}