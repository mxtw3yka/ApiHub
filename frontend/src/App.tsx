import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import AnimatedList from './AnimatedList'
import AnimatedContent from './AnimatedContent'
import GlareHover from './GlareHover'
import { TextType } from './navigation/Dock'
import { fetchContract } from './api'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { fetchSchemas, fetchDependencies, fetchChecks, runCheck } from './api'
import type {
  Schema,
  Dependency,
  Check,
  ServiceInfo,
  ServiceRole,
  Change,
  ContractResponse,
} from './types'
import './navigation/NavStyles.css'
import { type PageType } from './navigation/types'
import Dock from './navigation/Dock'
import Particles from './Particles'
import { ServicesPage, DependenciesPage, ChecksPage } from './navigation/Pages'

function getServiceRole(
  serviceId: string,
  deps: Dependency[],
): ServiceRole {
  let isConsumer = false
  let isProvider = false
  for (const d of deps) {
    if (d.consumer_service_id === serviceId) isConsumer = true
    if (d.provider_service_id === serviceId) isProvider = true
  }
  if (isConsumer && isProvider) return 'both'
  if (isProvider) return 'provider'
  if (isConsumer) return 'consumer'
  return 'none'
}

function buildServiceMap(schemas: Schema[]): Map<string, ServiceInfo> {
  const map = new Map<string, ServiceInfo>()
  for (const s of schemas) {
    const existing = map.get(s.service_id)
    if (!existing || s.version > existing.version) {
      map.set(s.service_id, {
        id: s.service_id,
        name: s.service_name,
        version: s.version,
        role: 'none',
        spec: s.spec,
      })
    }
  }
  return map
}

function buildDagreGraph(
  services: ServiceInfo[],
  deps: Dependency[],
) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120, marginx: 40, marginy: 40 })

  services.forEach((svc) => {
    let label = svc.name
    if (label.length > 18) label = label.slice(0, 16) + '…'
    g.setNode(svc.id, {
      width: 200,
      height: 72,
      label,
      version: svc.version,
      role: svc.role,
    })
  })

  deps.forEach((d) => {
    if (g.hasNode(d.consumer_service_id) && g.hasNode(d.provider_service_id)) {
      g.setEdge(d.consumer_service_id, d.provider_service_id)
    }
  })

  dagre.layout(g)

  const nodes: Node[] = services.map((svc) => {
    const pos = g.node(svc.id)
    return {
      id: svc.id,
      type: 'serviceNode',
      position: { x: pos.x - 100, y: pos.y - 36 },
      data: { label: svc.name, version: svc.version, role: svc.role },
    }
  })

  const edges: Edge[] = deps
    .filter(
      (d) =>
        services.some((s) => s.id === d.consumer_service_id) &&
        services.some((s) => s.id === d.provider_service_id),
    )
    .map((d) => ({
      id: d.id,
      source: d.consumer_service_id,
      target: d.provider_service_id,
      type: 'default',
      style: { stroke: '#fff', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#fff', width: 22, height: 22 },
    }))

  return { nodes, edges }
}

const ROLE_LABELS: Record<ServiceRole, string> = {
  none: '—',
  consumer: 'Клиент',
  provider: 'API',
  both: 'API + Клиент',
}

const ROLE_COLORS: Record<ServiceRole, string> = {
  none: '#94a3b8',
  consumer: '#8b5cf6',
  provider: '#0d9488',
  both: '#f59e0b',
}

function ServiceNode({ data }: NodeProps) {
  const role = data.role as ServiceRole
  const color = ROLE_COLORS[role] || '#d6d3d1'
  return (
    <div
      className="service-node"
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} />
      <div
        className="service-node-dot"
        style={{ background: color }}
      />
      <div className="service-node-body">
        <div className="service-node-name">{data.label as string}</div>
        <div className="service-node-meta">
          <span>v{data.version as string}</span>
          <span className="service-node-role">{ROLE_LABELS[role]}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const nodeTypes = { serviceNode: ServiceNode }

function parsePathSegments(path: string): string[] {
  const cleaned = path.replace(/^root/, '')
  return [...cleaned.matchAll(/\['([^']+)'\]/g)].map(m => m[1])
}

function extractTypeFromPyDict(s: string): string {
  if (!s) return ''
  try {
    const obj = JSON.parse(s.replace(/'/g, '"').replace(/True/g, 'true').replace(/False/g, 'false').replace(/None/g, 'null'))
    if (obj.$ref) return (obj.$ref as string).split('/').pop() || 'object'
    return (obj.type as string) || ''
  } catch {
    return ''
  }
}

const CAT_LABELS: Record<string, string> = {
  field_removed: 'удалено поле',
  field_added: 'добавлено поле',
  type_changed: 'изменён тип',
  endpoint_removed: 'удалён эндпоинт',
  endpoint_added: 'добавлен эндпоинт',
  format_changed: 'изменён формат',
  nullable_changed: 'изменён nullable',
}

function getChangeCategory(c: Change): string {
  if (c.category === 'endpoint_removed') {
    const segs = parsePathSegments(c.path)
    if (segs.some(s => s === 'parameters')) return 'изменён параметр'
  }
  return CAT_LABELS[c.category] || c.category.replace(/_/g, ' ')
}

function formatChangeMessage(c: Change): string {
  const segs = parsePathSegments(c.path)

  // Schema changes: components/schemas/...
  if (segs.length >= 3 && segs[0] === 'components' && segs[1] === 'schemas') {
    const schema = segs[2]

    // field_removed: whole property removed
    if (c.category === 'field_removed' && segs[3] === 'properties' && segs.length === 5) {
      const t = extractTypeFromPyDict(c.old_value)
      return `В схеме ${schema} удалено поле ${segs[4]}${t ? ` (${t})` : ''}`
    }
    // field_removed: nested attribute removed (e.g. name → maxLength)
    if (c.category === 'field_removed' && segs[3] === 'properties' && segs.length >= 6) {
      return `В схеме ${schema} у поля ${segs[4]} удалён атрибут ${segs.slice(5).join('.')}`
    }
    // field_added: whole property added
    if (c.category === 'field_added' && segs[3] === 'properties' && segs.length === 5) {
      const t = extractTypeFromPyDict(c.new_value)
      return `В схеме ${schema} добавлено поле ${segs[4]}${t ? ` (${t})` : ''}`
    }
    // field_added: nested attribute added (e.g. name → properties)
    if (c.category === 'field_added' && segs[3] === 'properties' && segs.length >= 6) {
      return `В схеме ${schema} у поля ${segs[4]} добавлен атрибут ${segs.slice(5).join('.')}`
    }
    // type_changed
    if (c.category === 'type_changed' && segs.length >= 6) {
      return `В схеме ${schema} у поля ${segs[4]} тип изменён: ${c.old_value} → ${c.new_value}`
    }
    // format_changed
    if (c.category === 'format_changed' && segs.length >= 6) {
      return `В схеме ${schema} у поля ${segs[4]} формат изменён: ${c.old_value} → ${c.new_value}`
    }
  }

  // Endpoint changes: paths/...
  if (segs.length >= 3 && segs[0] === 'paths') {
    const ep = `${segs[2].toUpperCase()} ${segs[1]}`
    if (c.category === 'endpoint_removed') {
      const tail = segs.slice(3).join('.')
      if (tail.includes('parameters')) {
        return `У эндпоинта ${ep} изменён параметр`
      }
      return `У эндпоинта ${ep} удалён ${tail}`
    }
    if (c.category === 'endpoint_added') {
      return `У эндпоинта ${ep} добавлен ${segs.slice(3).join('.')}`
    }
  }

  return c.description
}

function parsePyValue(s: string): unknown {
  try {
    return JSON.parse(s.replace(/'/g, '"').replace(/True/g, 'true').replace(/False/g, 'false').replace(/None/g, 'null'))
  } catch {
    return null
  }
}

function toYaml(obj: unknown, indent: number): string {
  const p = '  '.repeat(indent)
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map(v => `${p}- ${typeof v === 'object' ? '\n' + toYaml(v, indent + 1) : String(v)}`).join('\n')
    }
    return Object.entries(obj as Record<string, unknown>)
      .map(([k, v]) => {
        const val = typeof v === 'object' && v !== null ? '\n' + toYaml(v, indent + 1) : String(v)
        return `${p}${k}: ${val}`
      })
      .join('\n')
  }
  return p + String(obj)
}

function formatSpecFragment(path: string, value: string): string {
  if (!value) return ''

  const segs = parsePathSegments(path)

  // Try parsing as Python dict -> format as YAML
  const parsed = parsePyValue(value)
  if (parsed && typeof parsed === 'object') {
    return toYaml(parsed, 0)
  }

  // For scalar values, show key: value
  const lastKey = segs[segs.length - 1]
  const nullKeys = new Set(['root', 'components', 'schemas', 'paths', 'properties', 'content', 'schema', 'parameters'])
  let fieldStart = -1
  for (let i = segs.length - 1; i >= 0; i--) {
    if (!nullKeys.has(segs[i])) { fieldStart = i; break }
  }
  if (fieldStart >= 0 && fieldStart < segs.length - 1) {
    const ctxKeys = segs.slice(fieldStart, -1)
    const ctx = ctxKeys.map(k => `${k}:`).join('\n')
    return `${ctx}\n  ${lastKey}: ${value}`
  }

  return value
}

function formatChangePath(raw: string): string {
  const segs = parsePathSegments(raw)
  if (segs.length >= 3 && segs[0] === 'components' && segs[1] === 'schemas') {
    const schema = segs[2]
    const rest = segs.slice(3).filter(s => s !== 'properties' && s !== 'content' && s !== 'schema')
    return `${schema} → ${rest.join(' → ')}`
  }
  if (segs.length >= 2 && segs[0] === 'paths') {
    const p = segs[1]
    const method = segs[2]?.toUpperCase()
    const rest = segs.slice(3).map(s => /^\d+$/.test(s) ? `[${s}]` : s)
    return `${method} ${p} → ${rest.join(' → ')}`
  }
  return raw
}

const ATTR_LABELS: Record<string, string> = {
  type: 'Тип',
  format: 'Формат',
  description: 'Описание',
  enum: 'Допустимые значения',
  required: 'Обязательность',
  maxLength: 'Макс. длина',
  minLength: 'Мин. длина',
  example: 'Пример',
  nullable: 'Nullable',
  default: 'По умолч.',
  properties: 'Вложенные поля',
  items: 'Элементы',
}

function getValueLabel(raw: string, category: string): string {
  const segs = parsePathSegments(raw)
  const last = segs[segs.length - 1]
  if ((category === 'field_removed' || category === 'field_added') && segs[3] === 'properties' && segs.length === 5) {
    return `Поле ${segs[4]}`
  }
  if (ATTR_LABELS[last]) return ATTR_LABELS[last]
  return last
}

function pyToJson(s: string): string {
  if (!s) return ''
  try {
    return JSON.stringify(JSON.parse(s.replace(/'/g, '"').replace(/True/g, 'true').replace(/False/g, 'false').replace(/None/g, 'null')), null, 2)
  } catch {
    return s
  }
}

function makeDiffSnippets(c: Change): { before: string; after: string } {
  const segs = parsePathSegments(c.path)
  const isSchema = segs.length >= 3 && segs[0] === 'components' && segs[1] === 'schemas'
  const isEndpoint = segs.length >= 3 && segs[0] === 'paths'

  if (isSchema) {
    const field = segs.length >= 5 && segs[3] === 'properties' ? segs[4] : ''

    // type_changed: name → type
    if (c.category === 'type_changed' && field) {
      return {
        before: `"${field}": {\n  "type": "${c.old_value}"\n}`,
        after: `"${field}": {\n  "type": "${c.new_value}"\n}`,
      }
    }

    // field_removed: whole property
    if (c.category === 'field_removed' && segs.length === 5 && field) {
      const def = pyToJson(c.old_value) || ''
      return {
        before: `"${field}": ${def}`,
        after: `// "${field}" — удалено`,
      }
    }

    // field_removed: nested attribute
    if (c.category === 'field_removed' && segs.length >= 6 && field) {
      const attr = segs[5]
      return {
        before: `"${field}": {\n  "${attr}": ${c.old_value || '…'}\n}`,
        after: `"${field}": {\n  // ${attr} удалён\n}`,
      }
    }

    // field_added: whole property
    if (c.category === 'field_added' && segs.length === 5 && field) {
      const def = pyToJson(c.new_value) || ''
      return {
        before: `// "${field}" — добавлено`,
        after: `"${field}": ${def}`,
      }
    }

    // field_added: nested attribute
    if (c.category === 'field_added' && segs.length >= 6 && field) {
      const attr = segs[5]
      return {
        before: `"${field}": {\n  // ${attr} добавлен\n}`,
        after: `"${field}": {\n  "${attr}": ${c.new_value || '…'}\n}`,
      }
    }

    // format_changed
    if (c.category === 'format_changed' && field) {
      const attr = segs[5]
      return {
        before: `"${field}": {\n  "${attr}": "${c.old_value}"\n}`,
        after: `"${field}": {\n  "${attr}": "${c.new_value}"\n}`,
      }
    }
  }

  if (isEndpoint) {
    const method = segs[2]?.toUpperCase()
    const ep = `${method} ${segs[1]}`
    if (c.category === 'endpoint_removed') {
      return {
        before: `"${ep}": ${c.old_value ? '{...}' : ''}`,
        after: `// "${ep}" — удалено`,
      }
    }
    if (c.category === 'endpoint_added') {
      return {
        before: `// "${ep}" — добавлено`,
        after: `"${ep}": ${c.new_value ? '{...}' : ''}`,
      }
    }
  }

  return {
    before: c.old_value || '',
    after: c.new_value || '',
  }
}

function groupChangesBySeverity(changes: Change[]) {
  const critical = changes.filter((c) => c.severity === 'critical')
  const warning = changes.filter((c) => c.severity === 'warning')
  const info = changes.filter((c) => c.severity === 'info')
  return { critical, warning, info }
}

function formatTime(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const end = value
    const duration = 600
    const step = Math.ceil(end / (duration / 16))
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setDisplay(end); clearInterval(timer) }
      else setDisplay(start)
    }, 16)
    return () => clearInterval(timer)
  }, [value])
  return <>{display.toLocaleString()}</>
}

function shortId(id: string) {
  return id ? id.slice(0, 8) + '…' : ''
}

function ServiceDetails({
  service,
  deps,
  schemas,
  checks,
  onClose,
}: {
  service: ServiceInfo
  deps: Dependency[]
  schemas: Schema[]
  checks: Check[]
  onClose: () => void
}) {
  const providerDeps = deps.filter(
    (d) => d.provider_service_id === service.id,
  )
  const consumerDeps = deps.filter(
    (d) => d.consumer_service_id === service.id,
  )

  const nameMap = new Map<string, string>()
  for (const s of schemas) {
    nameMap.set(s.service_id, s.service_name)
  }

  const latestSchema = schemas
    .filter((s) => s.service_id === service.id)
    .sort((a, b) => b.version.localeCompare(a.version))[0]

  const specPaths = latestSchema?.spec?.paths as Record<string, unknown> | undefined
  const endpoints: { method: string; path: string; summary?: string }[] = []
  if (specPaths) {
    for (const [p, methods] of Object.entries(specPaths)) {
      if (typeof methods === 'object' && methods !== null) {
        for (const [m, detail] of Object.entries(methods as Record<string, unknown>)) {
          const d = detail as Record<string, unknown> | undefined
          endpoints.push({ method: m.toUpperCase(), path: p, summary: (d?.summary as string) || undefined })
        }
      }
    }
  }

  const relevantChecks = checks.filter(
    (c) =>
      c.result?.affected_consumers?.some((ac) => ac.id === service.id),
  )

  return (
    <div className="details-panel visible">
      <div className="details-close" onClick={onClose}>
        ✕
      </div>
      <div className="details-header">
        <strong>{service.name}</strong>
        <span
          className="role-badge"
          style={{
            background: ROLE_COLORS[service.role],
            color: '#fff',
          }}
        >
          {ROLE_LABELS[service.role]}
        </span>
        <span className="details-id">{shortId(service.id)}</span>
      </div>
      <div className="details-meta">
        Последняя: <code>v{service.version}</code>
      </div>

      {endpoints.length > 0 && (
        <div className="details-section">
          <h4>Эндпоинты ({endpoints.length})</h4>
          {endpoints.map((ep, i) => (
            <div key={i} className="endpoint-row">
              <span className={`method method-${ep.method.toLowerCase()}`}>
                {ep.method}
              </span>
              <code className="ep-path">{ep.path}</code>
              {ep.summary && (
                <span className="ep-summary">— {ep.summary}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {providerDeps.length > 0 && (
        <div className="details-section">
          <h4>Клиенты ({providerDeps.length})</h4>
          {providerDeps.map((d) => (
            <div key={d.id} className="dep-row">
              <span>
                {nameMap.get(d.consumer_service_id) ||
                  shortId(d.consumer_service_id)}
              </span>
              <span className="dep-constraint">{d.provider_constraint}</span>
            </div>
          ))}
        </div>
      )}

      {consumerDeps.length > 0 && (
        <div className="details-section">
          <h4>Зависит от ({consumerDeps.length})</h4>
          {consumerDeps.map((d) => (
            <div key={d.id} className="dep-row">
              <span>
                {nameMap.get(d.provider_service_id) ||
                  shortId(d.provider_service_id)}
              </span>
              <span className="dep-constraint">{d.provider_constraint}</span>
            </div>
          ))}
        </div>
      )}

      {relevantChecks.length > 0 && (
        <div className="details-section">
          <h4>Последние проверки</h4>
          {relevantChecks.slice(0, 3).map((c) => (
            <div key={c.id} className="dep-row">
              <span>
                {c.result?.compatible
                  ? '✅ Совместимо'
                  : '❌ Ломающие'}
              </span>
              <span className="dep-constraint">
                {formatTime(c.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {consumerDeps.length === 0 && providerDeps.length === 0 && (
        <div className="empty-state">Нет зависимостей</div>
      )}
    </div>
  )
}

function EdgeDetails({
  dep,
  schemas,
  onClose,
}: {
  dep: Dependency
  schemas: Schema[]
  onClose: () => void
}) {
  const nameMap = new Map<string, string>()
  for (const s of schemas) {
    nameMap.set(s.service_id, s.service_name)
  }

  const consumerName =
    nameMap.get(dep.consumer_service_id) || shortId(dep.consumer_service_id)
  const providerName =
    nameMap.get(dep.provider_service_id) || shortId(dep.provider_service_id)

  const [contractData, setContractData] = useState<ContractResponse | null>(null)
  const [contractLoading, setContractLoading] = useState(false)

  useEffect(() => {
    setContractData(null)
    setContractLoading(true)
    fetchContract(dep.id)
      .then(setContractData)
      .finally(() => setContractLoading(false))
  }, [dep.id])

  function displayType(t: string | null, f?: string | null): string {
    if (!t) return '—'
    let s = t
    if (f) s += `<${f}>`
    return s
  }

  function icon(_name: string, ptype: string | null, ctype: string | null) {
    if (!ptype && !ctype) return <span className="comp-icon comp-icon-ok" title="нет ни у кого">—</span>
    if (!ptype) return <span className="comp-icon comp-icon-missing" title="нет у API">✗</span>
    if (!ctype) return <span className="comp-icon comp-icon-missing" title="нет у клиента">✗</span>
    if (ptype !== ctype) return <span className="comp-icon comp-icon-warn" title="тип отличается">⚠</span>
    return <span className="comp-icon comp-icon-ok" title="совпадает">✓</span>
  }

  function matchCls(ptype: string | null, ctype: string | null): string {
    if (!ptype) return 'comp-only-cons'
    if (!ctype) return 'comp-only-prov'
    if (ptype !== ctype) return 'comp-mismatch'
    return 'comp-match'
  }

  return (
    <div className="details-panel visible">
      <div className="details-close" onClick={onClose}>
        ✕
      </div>
      <div className="details-header">
        <strong>Контракт</strong>
        <span className={`badge ${dep.status === 'active' ? 'badge-ok' : 'badge-warn'}`}>
          {dep.status}
        </span>
      </div>
      <div className="details-section">
        <div className="dep-row">
          <span>Клиент:</span>
          <strong>{consumerName}</strong>
        </div>
        <div className="dep-row">
          <span>API:</span>
          <strong>{providerName}</strong>
        </div>
        <div className="dep-row">
          <span>Ограничение:</span>
          <code>{dep.provider_constraint}</code>
        </div>
      </div>
      {contractLoading && <div className="details-loader">Загрузка контракта…</div>}
      {contractData && contractData.endpoints.map((ep, i) => (
        <div key={i} className="details-section">
          <div className="ep-card">
            <div className="ep-head">
              <span className={`method method-${ep.method.toLowerCase()}`}>{ep.method}</span>
              <code className="ep-path">{ep.path}</code>
              {ep.summary && <span className="ep-summary">{ep.summary}</span>}
            </div>

            {ep.parameters.length > 0 && (
              <div className="ep-table-wrap">
                <div className="ep-table-title">Параметры</div>
                <div className="ep-table">
                  <div className="ep-tr ep-th">
                    <span className="ep-td-name">Имя</span>
                    <span className="ep-td-in">In</span>
                    <span className="ep-td-type">API</span>
                    <span className="ep-td-type">Клиент</span>
                    <span className="ep-td-status" />
                  </div>
                  {ep.parameters.map(p => (
                    <div key={p.name} className={`ep-tr ${matchCls(p.provider_type, p.consumer_type)}`}>
                      <span className="ep-td-name">{p.name}{p.provider_required ? <span className="req-star">*</span> : ''}</span>
                      <span className="ep-td-in"><span className="tag-in">{p.param_in}</span></span>
                      <span className="ep-td-type type-prov">{displayType(p.provider_type, p.provider_format)}</span>
                      <span className="ep-td-type type-cons">{p.consumer_type ? displayType(p.consumer_type, p.consumer_format) : <span className="none">—</span>}</span>
                      <span className="ep-td-status">{icon(p.name, p.provider_type, p.consumer_type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ep.request_body_fields.length > 0 && (
              <div className="ep-table-wrap">
                <div className="ep-table-title">Тело запроса</div>
                <div className="ep-table">
                  <div className="ep-tr ep-th">
                    <span className="ep-td-name">Имя</span>
                    <span className="ep-td-in" />
                    <span className="ep-td-type">API</span>
                    <span className="ep-td-type">Клиент</span>
                    <span className="ep-td-status" />
                  </div>
                  {ep.request_body_fields.map(f => (
                    <div key={f.name} className={`ep-tr ${matchCls(f.provider_type, f.consumer_type)}`}>
                      <span className="ep-td-name">{f.name}{f.provider_required ? <span className="req-star">*</span> : ''}</span>
                      <span className="ep-td-in" />
                      <span className="ep-td-type type-prov">{displayType(f.provider_type, f.provider_format)}</span>
                      <span className="ep-td-type type-cons">{f.consumer_type ? displayType(f.consumer_type, f.consumer_format) : <span className="none">—</span>}</span>
                      <span className="ep-td-status">{icon(f.name, f.provider_type, f.consumer_type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ep.response_body_fields.length > 0 && (
              <div className="ep-table-wrap">
                <div className="ep-table-title">Ответ {ep.response_status_code ? `(${ep.response_status_code})` : ''}</div>
                <div className="ep-table">
                  <div className="ep-tr ep-th">
                    <span className="ep-td-name">Имя</span>
                    <span className="ep-td-in" />
                    <span className="ep-td-type">API</span>
                    <span className="ep-td-type">Клиент</span>
                    <span className="ep-td-status" />
                  </div>
                  {ep.response_body_fields.map(f => (
                    <div key={f.name} className={`ep-tr ${matchCls(f.provider_type, f.consumer_type)}`}>
                      <span className="ep-td-name">{f.name}{f.provider_required ? <span className="req-star">*</span> : ''}</span>
                      <span className="ep-td-in" />
                      <span className="ep-td-type type-prov">{displayType(f.provider_type, f.provider_format)}</span>
                      <span className="ep-td-type type-cons">{f.consumer_type ? displayType(f.consumer_type, f.consumer_format) : <span className="none">—</span>}</span>
                      <span className="ep-td-status">{icon(f.name, f.provider_type, f.consumer_type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ep.error_codes.length > 0 && (
              <div className="ep-table-wrap">
                <div className="ep-table-title">Коды ошибок</div>
                <div className="ep-table">
                  <div className="ep-tr ep-th">
                    <span className="ep-td-name">Код</span>
                    <span className="ep-td-in" />
                    <span className="ep-td-type">API</span>
                    <span className="ep-td-type">Клиент</span>
                    <span className="ep-td-status" />
                  </div>
                  {ep.error_codes.map(e => (
                    <div key={e.code} className={`ep-tr ${e.consumer_description ? 'comp-match' : 'comp-only-prov'}`}>
                      <span className="ep-td-name">{e.code}</span>
                      <span className="ep-td-in" />
                      <span className="ep-td-type type-prov">{e.provider_description || <span className="none">—</span>}</span>
                      <span className="ep-td-type type-cons">{e.consumer_description || <span className="none">—</span>}</span>
                      <span className="ep-td-status">{e.consumer_description ? <span className="comp-icon-ok">✓</span> : <span className="comp-icon-missing">✗</span>}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!ep.parameters.length && !ep.request_body_fields.length && !ep.response_body_fields.length && !ep.error_codes.length && (
              <div className="empty-inline">Нет данных контракта</div>
            )}
          </div>
        </div>
      ))}
      {contractData && !contractData.endpoints.length && (
        <div className="empty-state">Нет эндпоинтов для сравнения</div>
      )}
    </div>
  )
}

function CheckModal({
  services,
  schemas,
  onClose,
  onResult,
}: {
  services: ServiceInfo[]
  schemas: Schema[]
  onClose: () => void
  onResult: (check: Check) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [version, setVersion] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const latestMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of schemas) {
      const prev = m.get(s.service_id)
      if (!prev || s.version > prev) m.set(s.service_id, s.version)
    }
    return m
  }, [schemas])

  const selectedService = services.find((s) => s.id === selectedId)

  useEffect(() => {
    if (selectedId) {
      const latest = latestMap.get(selectedId) || ''
      const p = latest.split('.').map(Number)
      setVersion(p.length >= 2 && !isNaN(p[0]) ? `${p[0] + 1}.0.0` : '2.0.0')
    }
  }, [selectedId, latestMap])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !version) return
    setRunning(true)
    setError('')
    try {
      const check = await runCheck(selectedId, version)
      onResult(check)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="modal-overlay visible" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Запустить проверку совместимости</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Сервис
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                required
              >
                <option value="">— Выберите сервис —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (v{s.version})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Новая версия
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="например 2.0.0"
                required
              />
            </label>
          </div>
          {selectedService && (
            <div className="form-hint">
              Последняя: <code>v{latestMap.get(selectedId) || '—'}</code>
            </div>
          )}
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={running}>
              {running ? 'Запуск…' : 'Проверить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CheckResultView({
  check,
  onClose,
}: {
  check: Check
  onClose: () => void
}) {
  if (!check.result) {
    return (
      <div className="modal-overlay visible" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>Проверка выполняется</h3>
          <p>⏳ Проверка ещё выполняется.</p>
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    )
  }

  const r = check.result
  const changes = groupChangesBySeverity(r.changes)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function renderChangeItem(c: Change, i: number, severity: string) {
    const key = `${severity}-${i}`
    const open = expanded.has(key)
    const hasOld = !!c.old_value
    const hasNew = !!c.new_value
    return (
      <div
        key={key}
        className={`change-item severity-${severity} ${open ? 'expanded' : ''}`}
        onClick={() => {
          const next = new Set(expanded)
          if (open) next.delete(key); else next.add(key)
          setExpanded(next)
        }}
      >
        <div className="change-line">
          <span className="change-arrow">{open ? '▼' : '▶'}</span>
          <span className="change-cat">{getChangeCategory(c)}</span>
          <span className="change-desc">{formatChangeMessage(c)}</span>
        </div>
        {open && (
          <div className="change-details">
            {(hasOld || hasNew) && (
            <div className="cd-diff">
              {hasOld && (
              <div className="diff-box diff-old">
                <div className="diff-label">Было</div>
                <pre>{makeDiffSnippets(c).before}</pre>
              </div>)}
              {hasNew && (
              <div className="diff-box diff-new">
                <div className="diff-label">Стало</div>
                <pre>{makeDiffSnippets(c).after}</pre>
              </div>)}
            </div>)}
            {c.recommendation && (
              <div className="cd-rec">💡 {c.recommendation}</div>
            )}
          </div>
      )}
    </div>
  )
}

  return (
    <div className="modal-overlay visible" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="check-result-header">
          <h3>
            {r.compatible ? '✅ Совместимо' : '❌ Ломающие изменения'}
            <span className="check-meta">
              {check._serviceName || shortId(check.id)} ·{' '}
              {r.changes.length} изменений · {r.affected_consumers.length}{' '}
              потребителей затронуто
            </span>
          </h3>
        </div>

        <div className="check-changes">
          {changes.critical.length > 0 && (
            <div className="change-group">
              <h4 className="severity-critical">
                🚫 Критические ({changes.critical.length})
              </h4>
              {changes.critical.map((c, i) => renderChangeItem(c, i, 'critical'))}
            </div>
          )}
          {changes.warning.length > 0 && (
            <div className="change-group">
              <h4 className="severity-warning">
                ⚠️ Предупреждения ({changes.warning.length})
              </h4>
              {changes.warning.map((c, i) => renderChangeItem(c, i, 'warning'))}
            </div>
          )}
          {changes.info.length > 0 && (
            <div className="change-group">
              <h4 className="severity-info">
                ℹ️ Информация ({changes.info.length})
              </h4>
              {changes.info.map((c, i) => renderChangeItem(c, i, 'info'))}
            </div>
          )}
          {r.changes.length === 0 && (
            <div className="empty-state">Изменений не обнаружено</div>
          )}
        </div>

        {r.affected_consumers.length > 0 && (
          <div className="check-consumers">
            <h4>Затронутые потребители</h4>
            {r.affected_consumers.map((c) => (
              <span key={c.id} className="consumer-chip">
                ⚠ {c.name}
              </span>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [schemas, setSchemas] = useState<Schema[]>([])
  const [deps, setDeps] = useState<Dependency[]>([])
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(
    null,
  )
  const [selectedDep, setSelectedDep] = useState<Dependency | null>(null)
  const [showCheckModal, setShowCheckModal] = useState(false)
  const [checkResult, setCheckResult] = useState<Check | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rfWrapper = useRef<HTMLDivElement>(null)
  const graphCardRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState<PageType>('dashboard')

  const loadData = useCallback(async () => {
    try {
      const [s, d, c] = await Promise.all([
        fetchSchemas(),
        fetchDependencies(),
        fetchChecks(),
      ])
      setSchemas(s)
      setDeps(d)
      setChecks(c)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    intervalRef.current = setInterval(loadData, 10000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [loadData])

  const serviceMap = useMemo(() => buildServiceMap(schemas), [schemas])
  const services = useMemo(
    () =>
      [...serviceMap.values()].map((svc) => ({
        ...svc,
        role: getServiceRole(svc.id, deps),
      })),
    [serviceMap, deps],
  )

  const { nodes, edges } = useMemo(
    () => buildDagreGraph(services, deps),
    [services, deps],
  )
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes)
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges)
  const graphKeyRef = useRef('')

  useEffect(() => {
    const key =
      nodes.map((n) => n.id).sort().join(',') + '|' +
      edges.map((e) => e.source + '>' + e.target).sort().join(',')
    if (key !== graphKeyRef.current) {
      setFlowNodes(nodes)
      setFlowEdges(edges)
      graphKeyRef.current = key
    }
  }, [nodes, edges, setFlowNodes, setFlowEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const svc = services.find((s) => s.id === node.id)
      if (svc) {
        setSelectedService(svc)
        setSelectedDep(null)
      }
    },
    [services],
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const dep = deps.find((d) => d.id === edge.id)
      if (dep) {
        setSelectedDep(dep)
        setSelectedService(null)
      }
    },
    [deps],
  )

  const onPaneClick = useCallback(() => {
    setSelectedService(null)
    setSelectedDep(null)
  }, [])

  const handleCheckResult = useCallback((check: Check) => {
    setCheckResult(check)
    setShowCheckModal(false)
  }, [])

  const uniqueServiceCount = new Set(schemas.map((s) => s.service_id)).size
  const completedChecks = checks.filter((c) => c.result)
  const okChecks = completedChecks.filter((c) => c.result?.compatible)
  const badChecks = completedChecks.filter((c) => !c.result?.compatible)

  const recentChecks = useMemo(
    () =>
      [...checks]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )
        .slice(0, 10)
        .map((c) => ({
          ...c,
          _serviceName:
            schemas.find((s) => {
              const svc = services.find((sv) => sv.id === s.service_id)
              return c.result?.affected_consumers?.some(
                (ac) => ac.id === s.service_id,
              )
            })?.service_name || c._serviceName,
        })),
    [checks, schemas, services],
  )

  const checkItems = useMemo(
    () =>
      recentChecks.map((c) => (
        <div className="check-card">
          <div className="check-card-header">
            {c.result ? (
              <span className={`badge ${c.result.compatible ? 'badge-ok' : 'badge-bad'}`}>
                {c.result.compatible ? '✅ Совместимо' : '❌ Ломающие'}
              </span>
            ) : (
              <span className="badge badge-warn">⏳ В ожидании</span>
            )}
            <span className="check-service-name">
              {c._serviceName || shortId(c.id)}
            </span>
          </div>
          <div className="check-card-meta">
            {c.result
              ? `${c.result.changes.length} изменений, ${c.result.affected_consumers.length} потребителей`
              : ''}
          </div>
          <div className="check-card-time">
            {formatTime(c.created_at)}
          </div>
        </div>
      )),
    [recentChecks],
  )

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Загрузка…</p>
      </div>
    )
  }

    const dashContent = (
      <>
        <div className="top-bar">
          <div className="top-left">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <TextType texts={['API CONTRACT PLATFORM', 'COMPATIBILITY CHECKER', 'DEPENDENCY MANAGER']} />
          </div>
          <div className="top-actions">
            <button className="btn" onClick={loadData}>
              ↻ Обновить
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowCheckModal(true)}
            >
              + Новая проверка
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
            <button className="btn btn-sm" onClick={loadData}>
              Повторить
            </button>
          </div>
        )}

        <AnimatedContent distance={30} duration={0.6} threshold={0.1} className="stats">
          <GlareHover className="stat fade-in-up delay-1 tilt-card" width="100%" height="auto" background="transparent" borderRadius="0" borderColor="transparent" glareColor="#ffffff" glareOpacity={0.25} glareAngle={-30} glareSize={300} transitionDuration={600}
              style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: '18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}
              onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--tilt-x', `${((e.clientY - r.top) / r.height - .5) * -10}deg`); e.currentTarget.style.setProperty('--tilt-y', `${((e.clientX - r.left) / r.width - .5) * 10}deg`) }} onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty('--tilt-x', '0deg'); e.currentTarget.style.setProperty('--tilt-y', '0deg') }}>
            <div className="stat-accent teal" />
            <div className="stat-label">Сервисы</div>
            <div className="stat-value"><AnimatedNumber value={uniqueServiceCount} /></div>
          </GlareHover>
          <GlareHover className="stat fade-in-up delay-2 tilt-card" width="100%" height="auto" background="transparent" borderRadius="0" borderColor="transparent" glareColor="#ffffff" glareOpacity={0.25} glareAngle={-30} glareSize={300} transitionDuration={600}
              style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: '18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}
              onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--tilt-x', `${((e.clientY - r.top) / r.height - .5) * -10}deg`); e.currentTarget.style.setProperty('--tilt-y', `${((e.clientX - r.left) / r.width - .5) * 10}deg`) }} onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty('--tilt-x', '0deg'); e.currentTarget.style.setProperty('--tilt-y', '0deg') }}>
            <div className="stat-accent orange" />
            <div className="stat-label">Зависимости</div>
            <div className="stat-value"><AnimatedNumber value={deps.length} /></div>
          </GlareHover>
          <GlareHover className="stat fade-in-up delay-3 tilt-card" width="100%" height="auto" background="transparent" borderRadius="0" borderColor="transparent" glareColor="#ffffff" glareOpacity={0.25} glareAngle={-30} glareSize={300} transitionDuration={600}
              style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: '18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}
              onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--tilt-x', `${((e.clientY - r.top) / r.height - .5) * -10}deg`); e.currentTarget.style.setProperty('--tilt-y', `${((e.clientX - r.left) / r.width - .5) * 10}deg`) }} onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty('--tilt-x', '0deg'); e.currentTarget.style.setProperty('--tilt-y', '0deg') }}>
            <div className="stat-accent green" />
            <div className="stat-label">Совместимо</div>
            <div className="stat-value">
              {completedChecks.length > 0
                ? `${Math.round((okChecks.length / completedChecks.length) * 100)}%`
                : <AnimatedNumber value={0} />}
            </div>
          </GlareHover>
          <GlareHover className="stat fade-in-up delay-4 tilt-card" width="100%" height="auto" background="transparent" borderRadius="0" borderColor="transparent" glareColor="#ffffff" glareOpacity={0.25} glareAngle={-30} glareSize={300} transitionDuration={600}
              style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: '18px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}
              onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--tilt-x', `${((e.clientY - r.top) / r.height - .5) * -10}deg`); e.currentTarget.style.setProperty('--tilt-y', `${((e.clientX - r.left) / r.width - .5) * 10}deg`) }} onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty('--tilt-x', '0deg'); e.currentTarget.style.setProperty('--tilt-y', '0deg') }}>
            <div className="stat-accent rose" />
            <div className="stat-label">Ломающие</div>
            <div className="stat-value"><AnimatedNumber value={badChecks.length} /></div>
          </GlareHover>
        </AnimatedContent>

        <AnimatedContent distance={40} duration={0.7} threshold={0.1}>
        <div className="graph-card fade-in-up" ref={graphCardRef}>
          <div className="graph-header">
            <h2>Сервисы</h2>
          </div>
          <div className="graph-body" style={{ height: 400 }} ref={rfWrapper}>
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}

              fitView
              attributionPosition="bottom-left"
            >
              <Controls />
              <Background />
              <MiniMap />
            </ReactFlow>
          </div>
          <div className="legend">
              {(
                [
                  ['API', '#0d9488'],
                  ['Клиент', '#8b5cf6'],
                  ['Оба', '#f59e0b'],
                  ['—', '#94a3b8'],
                ] as const
              ).map(([label, color]) => (
              <span key={label} className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: color }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
        </AnimatedContent>

        <AnimatedContent distance={50} duration={0.7} threshold={0.1} className="bottom-grid">
          <div className="card">
            <div className="card-header">
              <h3>Зависимости</h3>
              <span className="card-count">{deps.length}</span>
            </div>
            <div className="card-body">
              {deps.length === 0 && (
                <div className="empty-state">Нет зависимостей</div>
              )}
              {deps.slice(0, 15).map((d) => {
                const cName =
                  schemas.find(
                    (s) => s.service_id === d.consumer_service_id,
                  )?.service_name || shortId(d.consumer_service_id)
                const pName =
                  schemas.find(
                    (s) => s.service_id === d.provider_service_id,
                  )?.service_name || shortId(d.provider_service_id)
                return (
                  <div
                    key={d.id}
                    className={`dep-item ${selectedDep?.id === d.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedDep(d)
                      setSelectedService(null)
                    }}
                  >
                    <span className="dep-name">{cName}</span>
                    <span className="dep-arrow">→</span>
                    <span className="dep-name">{pName}</span>
                    <span className="dep-constraint">
                      {d.provider_constraint}
                    </span>
                    <span
                      className={`dep-status ${d.status === 'active' ? 'ok' : ''}`}
                    >
                      {d.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Последние проверки</h3>
              <span className="card-count">{checks.length}</span>
            </div>
            <div className="card-body checks-body">
              {checkItems.length === 0 ? (
                <div className="empty-state">Нет проверок</div>
              ) : (
                <AnimatedList
                  items={checkItems}
                  onItemSelect={(index) => setCheckResult(recentChecks[index])}
                  showGradients={true}
                  enableArrowNavigation={true}
                  displayScrollbar={true}
                />
              )}
            </div>
          </div>
        </AnimatedContent>
      </>
    )

    return (
    <>
      <Particles
        particleCount={200}
        particleSpread={10}
        speed={0.1}
        particleBaseSize={100}
        particleColors={['#ffffff']}
        moveParticlesOnHover={false}
        alphaParticles={false}
        disableRotation={false}
        pixelRatio={Math.min(window.devicePixelRatio, 2)}
      />
      <div className="app-layout">
      <main className="main">
        {page === 'dashboard' && dashContent}
        {page === 'services' && (
          <ServicesPage services={services} onSelect={(svc) => { setSelectedService(svc); setSelectedDep(null) }} />
        )}
        {page === 'dependencies' && (
          <DependenciesPage deps={deps} schemas={schemas} selectedDep={selectedDep} onSelect={(d) => { setSelectedDep(d); setSelectedService(null) }} />
        )}
        {page === 'checks' && (
          <ChecksPage checks={checks} onSelect={(c) => setCheckResult(c)} />
        )}
      </main>

      <Dock page={page} setPage={setPage} />

      {selectedService && (
        <ServiceDetails
          service={selectedService}
          deps={deps}
          schemas={schemas}
          checks={checks}
          onClose={() => setSelectedService(null)}
        />
      )}

      {selectedDep && (
        <EdgeDetails
          dep={selectedDep}
          schemas={schemas}
          onClose={() => setSelectedDep(null)}
        />
      )}

      {showCheckModal && (
        <CheckModal
          services={services}
          schemas={schemas}
          onClose={() => setShowCheckModal(false)}
          onResult={handleCheckResult}
        />
      )}

      {checkResult && (
        <CheckResultView
          check={checkResult}
          onClose={() => setCheckResult(null)}
        />
      )}
    </div>
    </>
  )
}
