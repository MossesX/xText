import type { Request, Response, NextFunction } from 'express'

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'album'
  )
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function wrap(fn: (req: Request, res: Response) => unknown | Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

export function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

export function parseJson<T>(s: unknown, fallback: T): T {
  if (typeof s !== 'string') return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/** A SELECT * row that is known to carry a numeric id. */
export type IdRow = Record<string, unknown> & { id: number }
