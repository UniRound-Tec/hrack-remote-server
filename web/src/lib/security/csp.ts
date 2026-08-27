export function contentSecurityPolicy({
  isDevelopment,
  connectSources = []
}: {
  isDevelopment: boolean
  connectSources?: string[]
}): string {
  const relaySources = [...new Set(connectSources)].join(' ')
  return [
    "default-src 'self'",
    "base-uri 'self'",
    `connect-src 'self'${relaySources ? ` ${relaySources}` : ''}`,
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' blob: data:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${
      isDevelopment ? " 'unsafe-eval'" : ''
    }`,
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:"
  ].join('; ')
}
