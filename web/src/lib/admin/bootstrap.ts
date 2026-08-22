import { APIError } from 'better-auth/api'
import { getAuth } from '../auth'
import { countActiveAdmins } from './last-admin'
import {
  hasConfiguredSetupToken,
  matchesSetupToken
} from './setup-token'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class AdminSetupError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code)
    this.name = 'AdminSetupError'
  }
}

type SetupInput = {
  token: string
  email: string
  password: string
}

let setupChain: Promise<void> = Promise.resolve()

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = setupChain.then(operation, operation)
  setupChain = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function normalizeInput(input: SetupInput): SetupInput {
  const email = input.email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) {
    throw new AdminSetupError(400, 'INVALID_EMAIL')
  }
  if (input.password.length < 8 || input.password.length > 128) {
    throw new AdminSetupError(400, 'INVALID_PASSWORD')
  }
  return { ...input, email }
}

export function createFirstAdmin(input: SetupInput): Promise<Response> {
  return serialized(async () => {
    if (!hasConfiguredSetupToken() || (await countActiveAdmins()) > 0) {
      throw new AdminSetupError(404, 'NOT_FOUND')
    }
    if (!matchesSetupToken(input.token)) {
      throw new AdminSetupError(401, 'INVALID_SETUP_TOKEN')
    }

    const normalized = normalizeInput(input)
    const auth = getAuth()
    let createdUserId: string | undefined
    try {
      const created = await auth.api.createUser({
        body: {
          email: normalized.email,
          password: normalized.password,
          name: normalized.email.split('@')[0],
          role: 'admin',
          data: {
            emailVerified: true,
            banned: false,
            banReason: null,
            banExpires: null
          }
        }
      })
      createdUserId = created.user.id
    } catch (error) {
      if (error instanceof APIError && error.statusCode === 400) {
        throw new AdminSetupError(409, 'ACCOUNT_EXISTS')
      }
      throw new AdminSetupError(500, 'SETUP_FAILED')
    }

    const response = await auth.api.signInEmail({
      body: {
        email: normalized.email,
        password: normalized.password
      },
      asResponse: true
    })
    if (!response.ok || !response.headers.get('set-cookie')) {
      throw new AdminSetupError(500, 'SIGN_IN_FAILED')
    }

    console.info(
      JSON.stringify({
        event: 'admin.bootstrap',
        outcome: 'created',
        user_id: createdUserId
      })
    )
    return response
  })
}
