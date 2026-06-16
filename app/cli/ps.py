import httpx


def get_role(service_id: str, deps: list) -> str:
    is_consumer = any(d["consumer_service_id"] == service_id for d in deps)
    is_provider = any(d["provider_service_id"] == service_id for d in deps)
    if is_consumer and is_provider:
        return "Both"
    if is_provider:
        return "API"
    if is_consumer:
        return "Client"
    return "—"


def handle_ps(server: str) -> None:
    base = server.rstrip("/") + "/api/v1"

    with httpx.Client() as client:
        schemas_resp = client.get(f"{base}/schemas/")
        schemas_resp.raise_for_status()
        schemas_data = schemas_resp.json()

        deps_resp = client.get(f"{base}/dependencies/")
        deps_resp.raise_for_status()
        deps = deps_resp.json()

    items = schemas_data.get("items", schemas_data) if isinstance(schemas_data, dict) else schemas_data

    # Последняя версия каждого сервиса
    latest = {}
    for s in items:
        sid = s["service_id"]
        if sid not in latest or s["version"] > latest[sid]["version"]:
            latest[sid] = s

    if not latest:
        print("No services found")
        return

    print()
    print(f"{'Name':20} {'Version':10} {'Role':8} Updated")
    print(f"{'─' * 20} {'─' * 10} {'─' * 8} {'─' * 20}")

    for s in latest.values():
        role = get_role(s["service_id"], deps)
        created = s.get("created_at", "")[:10]
        print(f"{s['service_name']:20} {s['version']:10} {role:8} {created}")
    print()
