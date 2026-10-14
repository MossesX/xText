export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText)
  return data as T
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
  del: <T>(url: string) => request<T>('DELETE', url),
}

/** Uploads a raw body with progress reporting. */
export function uploadRaw(url: string, blob: Blob, contentType: string, meta: Record<string, unknown>, onProgress?: (fraction: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('x-meta', btoa(unescape(encodeURIComponent(JSON.stringify(meta)))))
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      let data: unknown = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* empty */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new ApiError(xhr.status, (data as { error?: string }).error ?? `Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'))
    xhr.send(blob)
  })
}
