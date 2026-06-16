import httpx
import sys
from app.cli.output import print_changes
from app.domain.dto.common import Change
from app.domain.dto.enums import ChangeCategory, Severity
from app.services.html_report import ConsumerInfo, HTMLReportRenderer, ReportData


def handle_check(
    service_id: str,
    version: str,
    server: str,
    html_path: str | None = None,
) -> None:
    base = server.rstrip("/") + "/api/v1"

    print(f"🔍 Running check for {service_id} v{version}...")

    with httpx.Client() as client:
        resp = client.post(f"{base}/check", json={
            "service_id": service_id,
            "version": version,
        })
        resp.raise_for_status()
        check_id = resp.json()["check_id"]

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
            service_name=service_id,
            version=version,
            compatible=compatible,
            changes=change_objects,
            affected_consumers=consumer_info,
        )
        HTMLReportRenderer().to_file(report_data, html_path)
        print(f"📄 Report saved to {html_path}")

    if compatible:
        print("✅ Compatible — no breaking changes")
        sys.exit(0)
    else:
        print("❌ Breaking changes detected")
        sys.exit(1)
