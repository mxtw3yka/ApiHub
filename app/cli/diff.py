import asyncio

from app.services.diff_service import DiffService
from app.services.html_report import HTMLReportRenderer, ReportData


def diff(
    diff_service: DiffService,
    spec_1: dict,
    spec_2: dict,
    html_path: str | None = None,
) -> list:
    changes = asyncio.run(diff_service.diff(spec_1, spec_2))

    if html_path:
        compatible = not any(
            (hasattr(c.severity, "value") and c.severity.value == "critical")
            or (not hasattr(c.severity, "value") and c.severity == "critical")
            for c in changes
        )
        data = ReportData(
            service_name="",
            version="",
            compatible=compatible,
            changes=changes,
        )
        HTMLReportRenderer().to_file(data, html_path)
        print(f"📄 Report saved to {html_path}")

    return changes