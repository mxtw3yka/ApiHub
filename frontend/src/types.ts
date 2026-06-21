export interface Schema {
  id: string
  service_id: string
  service_name: string
  version: string
  created_at: string
  spec?: Record<string, unknown>
}

export interface ServiceBrief {
  id: string
  name: string
}

export interface Dependency {
  id: string
  consumer_service_id: string
  provider_service_id: string
  provider_constraint: string
  status: string
  endpoints?: string[]
}

export interface Change {
  category: string
  severity: string
  path: string
  description: string
  old_value: string
  new_value: string
  recommendation: string
}

export interface CheckResult {
  compatible: boolean
  changes: Change[]
  affected_consumers: ServiceBrief[]
}

export interface Check {
  id: string
  status: string
  result?: CheckResult
  created_at: string
  _serviceName?: string
}

export type ServiceRole = 'none' | 'consumer' | 'provider' | 'both'

export interface ServiceInfo {
  id: string
  name: string
  version: string
  role: ServiceRole
  spec?: Record<string, unknown>
}

export type Role = 'none' | 'consumer' | 'provider' | 'both'

export interface ContractParam {
  name: string
  param_in: string
  provider_type: string | null
  provider_format: string | null
  provider_required: boolean
  consumer_type: string | null
  consumer_format: string | null
  consumer_required: boolean
}

export interface ContractField {
  name: string
  provider_type: string | null
  provider_format: string | null
  provider_required: boolean
  consumer_type: string | null
  consumer_format: string | null
  consumer_required: boolean
}

export interface ContractError {
  code: string
  provider_description: string
  consumer_description: string
}

export interface ContractEndpoint {
  method: string
  path: string
  summary: string
  parameters: ContractParam[]
  request_body_fields: ContractField[]
  response_body_fields: ContractField[]
  response_status_code: string
  error_codes: ContractError[]
}

export interface ContractResponse {
  consumer_id: string
  consumer_name: string
  provider_id: string
  provider_name: string
  endpoints: ContractEndpoint[]
}
