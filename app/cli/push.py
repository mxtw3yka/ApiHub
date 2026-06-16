import httpx
from app.cli.output import print_changes
from app.domain.dto.common import Change
from app.domain.dto.enums import ChangeCategory, Severity
from app.services.html_report import ConsumerInfo, HTMLReportRenderer, ReportData


def handle_push(
    spec: dict,
    service_name: str,
    version: str,
    server: str,
    html_path: str | None = None,
) -> None:
    base = server.rstrip("/") + "/api/v1"

    print(f"📦 Uploading {service_name} v{version}...")

    with httpx.Client() as client:
        # 1. POST /schemas/ — загружаем spec
        resp = client.post(f"{base}/schemas/", json={
            "service_name": service_name,
            "version": version,
            "spec": spec,
        })
        resp.raise_for_status()
        schema = resp.json()
        service_id = schema["service_id"]

        # 2. POST /check — запускаем проверку
        resp = client.post(f"{base}/check", json={
            "service_id": service_id,
            "version": version,
        })
        resp.raise_for_status()
        check_id = resp.json()["check_id"]

        # 3. GET /check/{check_id} — получаем результат
        resp = client.get(f"{base}/check/{check_id}")
        resp.raise_for_status()
        result = resp.json()

    data = result["result"]
    changes = data["changes"]
    compatible = data["compatible"]
    consumers = data["affected_consumers"]

    print_changes(changes)

    if consumers:
        print(f"📢 Affected consumers ({len(consumers)}):")
        for c in consumers:
            print(f"   • {c['name']}")

    if compatible:
        print("✅ Compatible — no breaking changes")
    else:
        print("❌ Breaking changes detected")

    if html_path:
        change_objects = [
            Change(
                category=ChangeCategory(c["category"]),
                severity=Severity(c["severity"]),
                path=c["path"],
                description=c["description"],
                old_value=c.get("old_value", ""),
                new_value=c.get("new_value", ""),
                recommendation=c.get("recommendation", ""),
            )
            for c in changes
        ]
        consumer_info = [ConsumerInfo(id=c["id"], name=c["name"]) for c in consumers]
        report_data = ReportData(
            service_name=service_name,
            version=version,
            compatible=compatible,
            changes=change_objects,
            affected_consumers=consumer_info,
        )
        HTMLReportRenderer().to_file(report_data, html_path)
        print(f"📄 Report saved to {html_path}")
