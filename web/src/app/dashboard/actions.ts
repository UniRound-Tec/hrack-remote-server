'use server'

import { getAuth } from '@/lib/auth'
import { createPairingActionService } from '@/lib/pairing/action-service'
import { loadRuntimeConfig } from '@/lib/settings/resolve'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

const pairingActions = createPairingActionService(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session) return null
  if (
    loadRuntimeConfig().emailVerificationRequired &&
    !session.user.emailVerified
  ) {
    return null
  }
  return session.user.id
})

export async function refreshPairingAction() {
  return pairingActions.get()
}

export async function createPairingAction(input: unknown) {
  const result = await pairingActions.create(input)
  if (result.ok) revalidatePath('/dashboard')
  return result
}

export async function revokePairingAction(input: unknown) {
  const result = await pairingActions.revoke(input)
  if (result.ok) revalidatePath('/dashboard')
  return result
}

export async function rotatePairingAction(input: unknown) {
  const result = await pairingActions.rotate(input)
  if (result.ok) revalidatePath('/dashboard')
  return result
}

export async function switchPairingNodeAction(input: unknown) {
  const result = await pairingActions.switchNode(input)
  if (result.ok) revalidatePath('/dashboard')
  return result
}
