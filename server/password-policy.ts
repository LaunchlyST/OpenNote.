/**
 * What makes an OpenNote password acceptable. Checked on the server for
 * sign-up, password reset and password change; the browser shows the same
 * rules as hints, but the server is what decides.
 */

const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyuiop',
  'qwerty123', 'iloveyou', 'letmein123', 'welcome123', 'admin1234', 'abc12345', 'football1',
  'monkey123', 'opennote', 'opennote1', 'opennote123', 'passw0rd', '11111111', '00000000',
])

export const PASSWORD_RULES = 'at least 10 characters, with a letter and a number or symbol'

export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < 10) return `Use a stronger password: ${PASSWORD_RULES}.`
  if (password.length > 128) return 'That password is too long (128 characters at most).'
  if (!/[a-z]/i.test(password) || !/[^a-z]/i.test(password)) return `Use a stronger password: ${PASSWORD_RULES}.`
  if (/^(.)\1+$/.test(password) || COMMON.has(password.toLowerCase())) return 'That password is too common. Please choose another one.'
  const local = email?.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return 'Your password should not contain your email address.'
  return null
}
