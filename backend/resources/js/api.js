// Klien API tipis untuk backend Laravel di origin yang sama: sesi cookie
// httpOnly + CSRF (bukan token di localStorage). Setiap permintaan tulis
// perlu token CSRF yang dibaca dari cookie XSRF-TOKEN yang diset Laravel.

function readCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

async function ensureCsrfCookie() {
  if (!readCookie('XSRF-TOKEN')) {
    await fetch('/api/csrf-cookie', { credentials: 'same-origin' })
  }
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function api(path, { method = 'GET', body, isForm = false } = {}) {
  if (method !== 'GET') await ensureCsrfCookie()

  const headers = { Accept: 'application/json' }
  if (!isForm) headers['Content-Type'] = 'application/json'
  const token = readCookie('XSRF-TOKEN')
  if (token) headers['X-XSRF-TOKEN'] = token

  const res = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })

  let data = null
  try { data = await res.json() } catch { /* respons kosong (mis. unduhan) */ }

  if (!res.ok) {
    throw new ApiError(data?.message || `Permintaan gagal (HTTP ${res.status})`, res.status, data)
  }
  return data
}
