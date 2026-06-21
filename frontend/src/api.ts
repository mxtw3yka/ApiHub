import type { Schema, Dependency, Check, CheckResult, ContractResponse } from './types'

const BASE = '/api/v1'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${r.status}`)
  }
  return r.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${r.status}`)
  }
  return r.json()
}

export async function fetchSchemas(): Promise<Schema[]> {
  const data = await get<{ items: Schema[] }>('/schemas/')
  return data.items || []
}

export async function fetchDependencies(): Promise<Dependency[]> {
  const data = await get<Dependency[]>('/dependencies/')
  return Array.isArray(data) ? data : []
}

export async function fetchChecks(): Promise<Check[]> {
  try {
    const data = await get<Check[]>('/check')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function fetchContract(dependencyId: string): Promise<ContractResponse> {
  return get<ContractResponse>(`/dependencies/${dependencyId}/contract`)
}

export async function runCheck(serviceId: string, version: string): Promise<Check> {
  const resp = await post<{ check_id: string }>('/check', {
    service_id: serviceId,
    version,
  })
  return get<Check>(`/check/${resp.check_id}`)
}
