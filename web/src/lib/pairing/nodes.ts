export interface RelayNode {
  id: string
  region: string
  label: string
  relayInternalOrigin: string
  relayPublicOrigin: string
  dshPublicOrigin: string
  serviceToken: string
  enabled: boolean
}

export interface PublicRelayNode {
  id: string
  region: string
  label: string
  healthUrl: string
}

interface RelayNodeEnv {
  RELAY_NODES_JSON?: string
  RELAY_INTERNAL_ORIGIN?: string
  RELAY_SERVICE_TOKEN?: string
  PUBLIC_ORIGIN?: string
  BETTER_AUTH_URL?: string
  DSH_PUBLIC_ORIGIN?: string
}

const NODE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/
const REGION_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/

function origin(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`)
  }
  const parsed = new URL(value)
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(`${field} must contain only scheme and authority`)
  }
  return parsed.origin
}

function securePublicOrigin(value: unknown, field: string): string {
  const normalized = origin(value, field)
  const parsed = new URL(normalized)
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !loopback) {
    throw new Error(`${field} must use HTTPS outside loopback development`)
  }
  return normalized
}

function parseNode(value: unknown, index: number): RelayNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`RELAY_NODES_JSON[${index}] must be an object`)
  }
  const input = value as Record<string, unknown>
  const id = input.id
  const region = input.region
  const label = input.label
  const serviceToken = input.serviceToken
  if (typeof id !== 'string' || !NODE_ID_PATTERN.test(id)) {
    throw new Error(`RELAY_NODES_JSON[${index}].id is invalid`)
  }
  if (typeof region !== 'string' || !REGION_PATTERN.test(region)) {
    throw new Error(`RELAY_NODES_JSON[${index}].region is invalid`)
  }
  if (
    typeof label !== 'string' ||
    label.trim().length === 0 ||
    label.length > 64
  ) {
    throw new Error(`RELAY_NODES_JSON[${index}].label is invalid`)
  }
  if (
    typeof serviceToken !== 'string' ||
    Buffer.byteLength(serviceToken, 'utf8') < 32
  ) {
    throw new Error(
      `RELAY_NODES_JSON[${index}].serviceToken must be at least 32 bytes`
    )
  }
  if (typeof input.enabled !== 'boolean') {
    throw new Error(`RELAY_NODES_JSON[${index}].enabled must be boolean`)
  }
  return {
    id,
    region,
    label: label.trim(),
    relayInternalOrigin: origin(
      input.relayInternalOrigin,
      `RELAY_NODES_JSON[${index}].relayInternalOrigin`
    ),
    relayPublicOrigin: securePublicOrigin(
      input.relayPublicOrigin,
      `RELAY_NODES_JSON[${index}].relayPublicOrigin`
    ),
    dshPublicOrigin: securePublicOrigin(
      input.dshPublicOrigin,
      `RELAY_NODES_JSON[${index}].dshPublicOrigin`
    ),
    serviceToken,
    enabled: input.enabled
  }
}

function legacyNode(env: RelayNodeEnv): RelayNode {
  const publicOrigin = env.PUBLIC_ORIGIN ?? env.BETTER_AUTH_URL
  return {
    id: 'us-1',
    region: 'us',
    label: 'United States',
    relayInternalOrigin: origin(env.RELAY_INTERNAL_ORIGIN, 'RELAY_INTERNAL_ORIGIN'),
    relayPublicOrigin: securePublicOrigin(publicOrigin, 'BETTER_AUTH_URL'),
    dshPublicOrigin: securePublicOrigin(
      env.DSH_PUBLIC_ORIGIN ?? publicOrigin,
      'DSH_PUBLIC_ORIGIN'
    ),
    serviceToken:
      typeof env.RELAY_SERVICE_TOKEN === 'string'
        ? env.RELAY_SERVICE_TOKEN
        : '',
    enabled: true
  }
}

export function loadRelayNodes(
  env: RelayNodeEnv = process.env as RelayNodeEnv
): RelayNode[] {
  let nodes: RelayNode[]
  if (env.RELAY_NODES_JSON === undefined || env.RELAY_NODES_JSON.trim() === '') {
    nodes = [legacyNode(env)]
    if (Buffer.byteLength(nodes[0]!.serviceToken, 'utf8') < 32) {
      throw new Error('RELAY_SERVICE_TOKEN must be at least 32 bytes')
    }
  } else {
    let parsed: unknown
    try {
      parsed = JSON.parse(env.RELAY_NODES_JSON)
    } catch {
      throw new Error('RELAY_NODES_JSON must be valid JSON')
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('RELAY_NODES_JSON must contain at least one node')
    }
    nodes = parsed.map(parseNode)
  }

  const ids = new Set<string>()
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`duplicate Relay node id: ${node.id}`)
    ids.add(node.id)
  }
  if (!nodes.some((node) => node.enabled)) {
    throw new Error('at least one Relay node must be enabled')
  }
  return nodes
}

export function enabledRelayNodes(nodes = loadRelayNodes()): RelayNode[] {
  return nodes.filter((node) => node.enabled)
}

export function publicRelayNodes(nodes = loadRelayNodes()): PublicRelayNode[] {
  return enabledRelayNodes(nodes).map(
    ({ id, region, label, relayPublicOrigin }) => ({
      id,
      region,
      label,
      healthUrl: `${relayPublicOrigin}/remote/healthz`
    })
  )
}

export function relayNodeById(
  nodeId: string,
  nodes = loadRelayNodes()
): RelayNode | undefined {
  return nodes.find((node) => node.id === nodeId && node.enabled)
}
