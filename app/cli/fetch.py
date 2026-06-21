import httpx
import yaml

COMMON_PATHS = [
    "/openapi.json",
    "/openapi.yaml",
    "/v3/api-docs",
    "/v2/api-docs",
    "/swagger/v1/swagger.json",
    "/swagger/doc.json",
    "/api-docs",
    "/api/swagger.json",
]


def fetch_spec_from_url(url: str, headers: dict[str, str] | None = None) -> dict:
    if any(url.endswith(ext) for ext in (".json", ".yaml", ".yml")):
        paths_to_try = [url]
    else:
        base = url.rstrip("/")
        paths_to_try = [f"{base}{p}" for p in COMMON_PATHS]

    last_error: str | None = None

    with httpx.Client(timeout=10.0, headers=headers) as client:
        for spec_url in paths_to_try:
            try:
                resp = client.get(spec_url)
                if resp.status_code == 200:
                    if spec_url.endswith((".yaml", ".yml")):
                        return yaml.safe_load(resp.text)
                    return resp.json()
                last_error = f"GET {spec_url} returned {resp.status_code}"
            except httpx.RequestError as e:
                last_error = f"GET {spec_url} failed: {e}"
                continue

    raise ValueError(
        f"Could not fetch OpenAPI spec from {url}. "
        f"Tried all common endpoints. Last error: {last_error}"
    )
