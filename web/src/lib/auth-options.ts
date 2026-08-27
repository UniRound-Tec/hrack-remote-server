import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, emailOTP, genericOAuth } from 'better-auth/plugins'
import { assertNotLastAdmin, countActiveAdmins } from './admin/last-admin'
import { getDb } from './db'
import * as schema from './db/schema'
import { isMailReady, sendVerificationOTP } from './mail/provider'
import { mapTrustedOAuthProfileToUser } from './oauth-link'
import {
  LINUX_DO_ACCOUNT_ISSUER,
  LINUX_DO_AUTHORIZATION_URL,
  LINUX_DO_PROVIDER_ID,
  LINUX_DO_TOKEN_URL,
  LINUX_DO_USER_INFO_URL,
  linuxDoAccountSubject,
  mapLinuxDoProfile
} from './linuxdo'
import { loadTrustedOrigins } from './settings/trusted-origins'
import {
  loadRuntimeConfig,
  type RuntimeAuthConfig
} from './settings/resolve'

export function createAuth(
  runtime: RuntimeAuthConfig = loadRuntimeConfig(),
  extraPlugins: BetterAuthPlugin[] = []
) {
  return betterAuth({
    appName: 'HRack',
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: 'sqlite', schema }),
    trustedOrigins: loadTrustedOrigins(),
    disabledPaths: [
      '/sign-in/email-otp',
      '/email-otp/request-password-reset',
      '/forget-password/email-otp',
      '/email-otp/reset-password',
      '/admin/impersonate-user',
      '/admin/stop-impersonating'
    ],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: runtime.emailVerificationRequired,
      autoSignIn: !runtime.emailVerificationRequired,
      customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
        ...coreFields,
        role: 'user',
        banned: false,
        banReason: null,
        banExpires: null,
        ...additionalFields,
        id
      }),
      onExistingUserSignUp: async () => undefined
    },
    emailVerification: {
      sendOnSignUp: runtime.emailVerificationRequired,
      sendOnSignIn: runtime.emailVerificationRequired,
      autoSignInAfterVerification: true
    },
    socialProviders: {
      ...(runtime.github
        ? {
            github: {
              ...runtime.github,
              mapProfileToUser: mapTrustedOAuthProfileToUser
            }
          }
        : {}),
      ...(runtime.google
        ? {
            google: {
              ...runtime.google,
              mapProfileToUser: mapTrustedOAuthProfileToUser
            }
          }
        : {})
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['github', 'google']
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      cookieCache: { enabled: false }
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-up/email': { window: 60, max: 10 },
        '/sign-in/email': { window: 60, max: 10 },
        '/change-password': { window: 60, max: 5 },
        '/email-otp/send-verification-otp': { window: 60, max: 5 },
        '/email-otp/verify-email': { window: 60, max: 10 }
      }
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] },
      useSecureCookies:
        process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false
    },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => {
            const bootstrap = process.env.ADMIN_BOOTSTRAP_EMAIL
              ?.trim()
              .toLowerCase()
            if (
              bootstrap &&
              newUser.email.toLowerCase() === bootstrap &&
              (await countActiveAdmins()) === 0
            ) {
              return { data: { ...newUser, role: 'admin' } }
            }
            return { data: newUser }
          }
        }
      }
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path === '/sign-up/email' &&
          runtime.emailVerificationRequired &&
          !(await isMailReady())
        ) {
          throw new APIError('BAD_REQUEST', {
            code: 'MAIL_UNAVAILABLE',
            message: 'Mail unavailable'
          })
        }
        if (
          ctx.path === '/admin/set-role' ||
          ctx.path === '/admin/ban-user' ||
          ctx.path === '/admin/remove-user' ||
          ctx.path === '/admin/update-user'
        ) {
          await assertNotLastAdmin(ctx)
        }
      })
    },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: false,
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        resendStrategy: 'reuse',
        storeOTP: 'hashed',
        disableSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'email-verification') {
            throw new APIError('NOT_FOUND', {
              code: 'NOT_FOUND',
              message: 'Not found'
            })
          }
          void sendVerificationOTP({ email, otp, type }).catch(() => {
            console.error(
              JSON.stringify({ event: 'mail.send_fail', outcome: 'failed' })
            )
          })
        }
      }),
      admin({ defaultRole: 'user', adminRoles: ['admin'] }),
      ...(runtime['linux-do']
        ? [
            genericOAuth({
              config: [
                {
                  providerId: LINUX_DO_PROVIDER_ID,
                  name: 'Linux.do',
                  ...runtime['linux-do'],
                  authorizationUrl: LINUX_DO_AUTHORIZATION_URL,
                  tokenUrl: LINUX_DO_TOKEN_URL,
                  userInfoUrl: LINUX_DO_USER_INFO_URL,
                  authentication: 'basic',
                  accountIssuer: LINUX_DO_ACCOUNT_ISSUER,
                  accountSubject: ({ profile }) =>
                    linuxDoAccountSubject(profile),
                  mapProfileToUser: mapLinuxDoProfile,
                  requireEmailVerification: false,
                  pkce: true
                }
              ]
            })
          ]
        : []),
      ...extraPlugins
    ]
  })
}
