export function getClientIp(request: Request): string | null {
  const cfIp = request.headers.get('CF-Connecting-IP')?.trim()
  if (cfIp) {
    return cfIp
  }

  const forwarded = request.headers.get('X-Forwarded-For')?.trim()
  if (!forwarded) {
    return null
  }

  const firstHop = forwarded.split(',')[0]?.trim()
  return firstHop || null
}
