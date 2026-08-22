import { loadRuntimeConfig } from '@/lib/settings/resolve'

export function GET(): Response {
  const runtime = loadRuntimeConfig()
  return Response.json({
    github: Boolean(runtime.github),
    google: Boolean(runtime.google),
    emailVerificationRequired: runtime.emailVerificationRequired
  })
}
