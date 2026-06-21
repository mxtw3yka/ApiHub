import { type PageType, type NavStyle } from './types'
import type { Dependency, Check, ServiceInfo, Schema } from '../types'
import { ROLE_COLORS, shortId, formatTime, AnimatedNumber } from './utils'
import AnimatedContent from '../AnimatedContent'

export function ServicesPage({
  services,
  onSelect,
}: {
  services: ServiceInfo[]
  onSelect: (s: ServiceInfo) => void
}) {
  return (
    <AnimatedContent distance={40} duration={0.6} threshold={0.1} className="page-section">
      <h2>Services</h2>
      {services.length === 0 ? (
        <div className="empty-page">
          <div className="empty-page-icon">⬡</div>
          <div className="empty-page-text">No services</div>
        </div>
      ) : (
        <div className="services-grid">
          {services.map((svc, i) => (
            <div key={svc.id} className="service-card" onClick={() => onSelect(svc)}
              style={{ animation: `fade-up .4s ease-out ${i * 0.05}s both` }}>
              <div className="service-card-header">
                <span className="service-card-dot" style={{ background: ROLE_COLORS[svc.role] }} />
                <span className="service-card-name">{svc.name}</span>
              </div>
              <div className="service-card-meta">
                <span>v{svc.version}</span>
                <span className="service-card-role" style={{ color: ROLE_COLORS[svc.role] }}>
                  {svc.role === 'none' ? '—' : svc.role === 'provider' ? 'API' : svc.role === 'consumer' ? 'Client' : 'Both'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AnimatedContent>
  )
}

export function DependenciesPage({
  deps,
  schemas,
  selectedDep,
  onSelect,
}: {
  deps: Dependency[]
  schemas: Schema[]
  selectedDep: Dependency | null
  onSelect: (d: Dependency) => void
}) {
  const svcName = (id: string) =>
    schemas.find((s) => s.service_id === id)?.service_name || shortId(id)

  return (
    <AnimatedContent distance={40} duration={0.6} threshold={0.1} className="page-section">
      <h2>Dependencies ({deps.length})</h2>
      {deps.length === 0 ? (
        <div className="empty-page">
          <div className="empty-page-icon">⇌</div>
          <div className="empty-page-text">No dependencies</div>
        </div>
      ) : (
        <div className="deps-table">
          <div className="deps-table-row deps-table-header">
            <span>Consumer</span>
            <span />
            <span>Provider</span>
            <span>Constraint</span>
            <span>Status</span>
          </div>
          {deps.map((d, i) => (
            <div
              key={d.id}
              className={`deps-table-row ${selectedDep?.id === d.id ? 'selected' : ''}`}
              onClick={() => onSelect(d)}
              style={{ animation: `fade-up .35s ease-out ${i * 0.03}s both` }}
            >
              <span>{svcName(d.consumer_service_id)}</span>
              <span className="deps-arrow-cell">→</span>
              <span>{svcName(d.provider_service_id)}</span>
              <span style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 12, color: 'var(--text-muted)' }}>
                {d.provider_constraint}
              </span>
              <span className={`dep-status ${d.status === 'active' ? 'ok' : ''}`}>{d.status}</span>
            </div>
          ))}
        </div>
      )}
    </AnimatedContent>
  )
}

export function ChecksPage({
  checks,
  onSelect,
}: {
  checks: Check[]
  onSelect: (c: Check) => void
}) {
  const sorted = [...checks].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <AnimatedContent distance={40} duration={0.6} threshold={0.1} className="page-section">
      <h2>Checks ({checks.length})</h2>
      {checks.length === 0 ? (
        <div className="empty-page">
          <div className="empty-page-icon">✓</div>
          <div className="empty-page-text">No checks yet</div>
        </div>
      ) : (
        <div className="checks-page-list">
          {sorted.map((c, i) => (
            <div key={c.id} className="checks-page-card" onClick={() => onSelect(c)}
              style={{ animation: `fade-up .35s ease-out ${i * 0.03}s both` }}>
              <div className="checks-page-main">
                <span className={`badge ${c.status === 'compatible' ? 'badge-ok' : c.status === 'breaking' ? 'badge-bad' : 'badge-warn'}`}>
                  {c.status === 'compatible' ? '✅ Compatible' : c.status === 'breaking' ? '❌ Breaking' : '⏳ Pending'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{c._serviceName || shortId(c.id)}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {formatTime(c.created_at)}
                </span>
              </div>
              {c.result && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {c.result.changes.length} changes · {c.result.affected_consumers.length} affected consumers
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AnimatedContent>
  )
}
