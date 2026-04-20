import { OaServerDocument } from '../oaspec-documents'
import { oaspecId } from '../oaspec-id'
import {
  ExtractionContext,
  ExtractionResult,
  ISpecExtractor,
  OaspecEntity,
} from '../extractor.types'

function deriveHostShape(serverUrl: string): {
  scheme: string
  hostTemplate: string
  hostShape: string
  dnsSuffix: string
  fixedLabelsText: string
  varLabelsText: string
  basePath: string
} {
  let parsed: URL
  try {
    parsed = new URL(serverUrl.replace(/\{[^}]+\}/g, 'placeholder'))
  } catch {
    return {
      scheme: 'https',
      hostTemplate: serverUrl,
      hostShape: serverUrl,
      dnsSuffix: '',
      fixedLabelsText: '',
      varLabelsText: '',
      basePath: '/',
    }
  }

  const scheme = parsed.protocol.replace(':', '')
  const basePath = parsed.pathname || '/'
  const hostTemplate = serverUrl.includes('://')
    ? (serverUrl.split('://')[1]?.split('/')[0] ?? parsed.hostname)
    : parsed.hostname

  const varPattern = /\{([^}]+)\}/g
  const varLabels: string[] = []
  let m: RegExpExecArray | null
  while ((m = varPattern.exec(hostTemplate)) !== null) varLabels.push(m[1]!)

  const hostShape = hostTemplate.replace(/\{[^}]+\}/g, '*')
  const labels = hostShape.split('.')
  const dnsSuffix = labels.length >= 2 ? labels.slice(-2).join('.') : hostShape
  const fixedLabels = hostShape.split('.').filter((l) => l !== '*' && l !== '')

  return {
    scheme,
    hostTemplate,
    hostShape,
    dnsSuffix,
    fixedLabelsText: fixedLabels.join(' '),
    varLabelsText: varLabels.join(' '),
    basePath,
  }
}

type RawServer = {
  url?: string
  description?: string
  variables?: Record<string, { default?: string }>
}

export class ServerExtractor implements ISpecExtractor<OaServerDocument> {
  readonly entity: OaspecEntity = 'server'

  extract(ctx: ExtractionContext): ExtractionResult<OaServerDocument> {
    const { spec, tenantId, apiId, specId, version, indexedAt } = ctx
    const title: string = spec['info']?.title ?? ''
    const servers: RawServer[] = spec['servers'] ?? []

    const documents: OaServerDocument[] = servers.map((server, idx) => ({
      id: oaspecId(tenantId, title, version, server.url ?? String(idx)),
      apiId,
      specId,
      tenantId,
      version,
      serverIndex: idx,
      latest: true,
      indexedAt,
      rawUrl: server.url ?? '',
      description: server.description,
      variablesText: server.variables
        ? Object.entries(server.variables)
            .map(([k, v]) => `${k}:${v?.default ?? ''}`)
            .join(' ')
        : undefined,
      ...deriveHostShape(server.url ?? ''),
    }))

    return { documents, truncated: false, warnings: [] }
  }
}
