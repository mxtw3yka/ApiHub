from uuid import UUID
from re import findall
from app.domain.dto.common import (
    ContractResponse,
    ContractEndpoint,
    ContractParam,
    ContractField,
    ContractError,
)
from app.services.schema_service import SchemaService
from app.services.dependency_service import DependencyService
from app.core.exceptions import DependencyNotFoundError


def _resolve_ref(ref: str, spec: dict) -> dict | None:
    parts = ref.lstrip("#/").split("/")
    cur: dict | None = spec
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur if isinstance(cur, dict) else None


def _extract_schema(raw: dict | None, spec: dict) -> dict | None:
    if not raw or not isinstance(raw, dict):
        return None
    if "$ref" in raw:
        resolved = _resolve_ref(raw["$ref"], spec)
        return _extract_schema(resolved, spec)
    return {
        "type": raw.get("type", "object"),
        "format": raw.get("format"),
        "properties": raw.get("properties"),
        "required": list(raw.get("required", []) or []),
        "items": raw.get("items"),
    }


def _get_operation(spec: dict | None, method: str, path: str) -> dict | None:
    if not spec:
        return None
    path_item = spec.get("paths", {}).get(path, {})
    if not isinstance(path_item, dict):
        return None
    op = path_item.get(method.lower())
    return op if isinstance(op, dict) else None


def _get_endpoint_params(spec: dict | None, method: str, path: str) -> list[dict]:
    op = _get_operation(spec, method, path)
    if not op:
        return []
    params = op.get("parameters", []) or []
    result = []
    for p in params:
        if not isinstance(p, dict):
            continue
        s = _extract_schema(p.get("schema"), spec)
        result.append({
            "name": p.get("name", ""),
            "in": p.get("in", ""),
            "type": (s.get("type") if s else None) or "string",
            "format": s.get("format") if s else None,
            "required": p.get("required", False),
        })
    return result


def _get_response_schema(spec: dict | None, method: str, path: str) -> tuple[dict | None, str]:
    op = _get_operation(spec, method, path)
    if not op:
        return None, ""
    responses = op.get("responses", {}) or {}
    for code in ("200", "201", "default"):
        resp = responses.get(code)
        if not isinstance(resp, dict):
            continue
        content = resp.get("content", {}) or {}
        for ct in ("application/json", "*/*"):
            media = content.get(ct)
            if not isinstance(media, dict):
                continue
            sch = _extract_schema(media.get("schema"), spec)
            if sch:
                return sch, code
    return None, ""


def _get_request_schema(spec: dict | None, method: str, path: str) -> dict | None:
    op = _get_operation(spec, method, path)
    if not op:
        return None
    req_body = op.get("requestBody")
    if not isinstance(req_body, dict):
        return None
    content = req_body.get("content", {}) or {}
    for ct in ("application/json", "*/*"):
        media = content.get(ct)
        if not isinstance(media, dict):
            continue
        sch = _extract_schema(media.get("schema"), spec)
        if sch:
            return sch
    return None


def _get_errors(spec: dict | None, method: str, path: str) -> dict[str, str]:
    op = _get_operation(spec, method, path)
    if not op:
        return {}
    responses = op.get("responses", {}) or {}
    result = {}
    for code, resp in responses.items():
        if isinstance(resp, dict):
            desc = resp.get("description", "")
            result[code] = desc if isinstance(desc, str) else ""
    return result


def _get_field_type(schema: dict | None, field_name: str, root_spec: dict) -> dict | None:
    if not schema or not isinstance(schema.get("properties"), dict):
        return None
    props = schema["properties"]
    raw = props.get(field_name)
    if not isinstance(raw, dict):
        return None
    required = field_name in (schema.get("required") or [])

    field = raw
    if "$ref" in field:
        resolved = _resolve_ref(field["$ref"], root_spec)
        if resolved:
            field = resolved
        else:
            return {"type": "object", "required": required, "refType": field["$ref"].split("/").pop()}

    if isinstance(field.get("items"), dict):
        items = field["items"]
        if "$ref" in items:
            ref_path = items["$ref"].split("/").pop()
            return {"type": f"array<{ref_path}>", "required": required, "refType": ref_path}
        return {"type": f"array<{items.get('type', 'object')}>", "required": required, "format": items.get("format")}

    return {
        "type": field.get("type", "object"),
        "format": field.get("format"),
        "required": required,
        "description": field.get("description"),
        "enumValues": field.get("enum"),
    }


def _collect_field_names(
    prov_schema: dict | None,
    cons_schema: dict | None,
) -> set[str]:
    names: set[str] = set()
    if prov_schema and isinstance(prov_schema.get("properties"), dict):
        names.update(prov_schema["properties"].keys())
    if cons_schema and isinstance(cons_schema.get("properties"), dict):
        names.update(cons_schema["properties"].keys())
    return names


def _extract_method_path(endpoint_str: str) -> tuple[str, str]:
    parts = endpoint_str.strip().split(None, 1)
    if len(parts) == 2:
        return parts[0].upper(), parts[1]
    return "GET", parts[0] if parts else ""


class ContractService:
    def __init__(self, schema_service: SchemaService, dep_service: DependencyService):
        self.schema_service = schema_service
        self.dep_service = dep_service

    async def get_contract(self, dependency_id: UUID) -> ContractResponse:
        dep = await self.dep_service.get_dependency(dependency_id)

        consumer_schema = await self.schema_service.get_latest_schema(dep.consumer_service_id)
        provider_schema = await self.schema_service.get_latest_schema(dep.provider_service_id)
        prov_spec = provider_schema.spec if provider_schema else None
        cons_spec = consumer_schema.spec if consumer_schema else None

        endpoints: list[ContractEndpoint] = []

        for ep in dep.endpoints or []:
            method, path = _extract_method_path(ep)

            prov_params = _get_endpoint_params(prov_spec, method, path)
            cons_params = _get_endpoint_params(cons_spec, method, path)
            prov_req = _get_request_schema(prov_spec, method, path)
            cons_req = _get_request_schema(cons_spec, method, path)
            prov_resp, status_code = _get_response_schema(prov_spec, method, path)
            cons_resp, _ = _get_response_schema(cons_spec, method, path)

            all_param_names: set[str] = set()
            for p in prov_params:
                all_param_names.add(p["name"])
            for p in cons_params:
                all_param_names.add(p["name"])

            parameters: list[ContractParam] = []
            for name in sorted(all_param_names):
                pp = next((p for p in prov_params if p["name"] == name), None)
                cp = next((p for p in cons_params if p["name"] == name), None)
                parameters.append(ContractParam(
                    name=name,
                    param_in=(pp or cp or {}).get("in", ""),
                    provider_type=pp.get("type") if pp else None,
                    provider_format=pp.get("format") if pp else None,
                    provider_required=pp.get("required", False) if pp else False,
                    consumer_type=cp.get("type") if cp else None,
                    consumer_format=cp.get("format") if cp else None,
                    consumer_required=cp.get("required", False) if cp else False,
                ))

            req_fields: list[ContractField] = []
            req_names = _collect_field_names(prov_req, cons_req)
            for fname in sorted(req_names):
                pf = _get_field_type(prov_req, fname, prov_spec) if prov_spec else None
                cf = _get_field_type(cons_req, fname, cons_spec) if cons_spec else None
                req_fields.append(ContractField(
                    name=fname,
                    provider_type=pf.get("type") if pf else None,
                    provider_format=pf.get("format") if pf else None,
                    provider_required=pf.get("required", False) if pf else False,
                    consumer_type=cf.get("type") if cf else None,
                    consumer_format=cf.get("format") if cf else None,
                    consumer_required=cf.get("required", False) if cf else False,
                ))

            resp_fields: list[ContractField] = []
            resp_names = _collect_field_names(prov_resp, cons_resp)
            for fname in sorted(resp_names):
                pf = _get_field_type(prov_resp, fname, prov_spec) if prov_spec else None
                cf = _get_field_type(cons_resp, fname, cons_spec) if cons_spec else None
                resp_fields.append(ContractField(
                    name=fname,
                    provider_type=pf.get("type") if pf else None,
                    provider_format=pf.get("format") if pf else None,
                    provider_required=pf.get("required", False) if pf else False,
                    consumer_type=cf.get("type") if cf else None,
                    consumer_format=cf.get("format") if cf else None,
                    consumer_required=cf.get("required", False) if cf else False,
                ))

            prov_err = _get_errors(prov_spec, method, path)
            cons_err = _get_errors(cons_spec, method, path)
            all_codes: set[str] = set(prov_err.keys()) | set(cons_err.keys())
            error_codes: list[ContractError] = []
            for code in sorted(all_codes, key=lambda c: 999 if c == "default" else (int(c) if c.isdigit() else 0)):
                error_codes.append(ContractError(
                    code=code,
                    provider_description=prov_err.get(code, ""),
                    consumer_description=cons_err.get(code, ""),
                ))

            op = _get_operation(prov_spec, method, path)
            summary = (op.get("summary") if op else None) or ""

            endpoints.append(ContractEndpoint(
                method=method,
                path=path,
                summary=summary,
                parameters=parameters,
                request_body_fields=req_fields,
                response_body_fields=resp_fields,
                response_status_code=status_code,
                error_codes=error_codes,
            ))

        return ContractResponse(
            consumer_id=str(dep.consumer_service_id),
            consumer_name=consumer_schema.service_name if consumer_schema else "",
            provider_id=str(dep.provider_service_id),
            provider_name=provider_schema.service_name if provider_schema else "",
            endpoints=endpoints,
        )
