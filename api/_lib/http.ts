/**
 * The slice of the Vercel Node request/response contract these endpoints use.
 *
 * Declared locally so the deployment API can be type-checked without adding
 * `@vercel/node` as a dependency. Both the platform and `vercel dev` satisfy
 * exactly this shape.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface ApiRequest extends IncomingMessage {
  body?: unknown
  query?: Record<string, string | string[] | undefined>
  cookies?: Record<string, string>
}

export interface ApiResponse extends ServerResponse {
  status: (code: number) => ApiResponse
  json: (body: unknown) => ApiResponse
}

/** Declared on its own: overriding `setHeader` in a subtype trips the `this`
 *  check on `ServerResponse`, and the platform's own type returns `this`. */
export function setCookie(
  res: ApiResponse,
  value: string,
): void {
  res.setHeader('Set-Cookie', value)
}

export type ApiHandler = (
  req: ApiRequest,
  res: ApiResponse,
) => void | Promise<void>

/** Parses a JSON request body, tolerating an empty or malformed one. */
export async function readJsonBody(req: ApiRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  if (chunks.length === 0) return {}

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Whether the caller reached the function over TLS (for the session cookie). */
export function isSecureRequest(req: ApiRequest): boolean {
  const proto = req.headers['x-forwarded-proto']
  const value = Array.isArray(proto) ? proto[0] : proto
  return value ? value.split(',')[0].trim() === 'https' : false
}