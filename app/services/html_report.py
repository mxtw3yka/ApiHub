from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.dto.common import Change


@dataclass
class ConsumerInfo:
    id: str
    name: str


@dataclass
class ReportData:
    service_name: str
    version: str
    compatible: bool
    date_generated: str = ""
    changes: list[Change] = field(default_factory=list)
    affected_consumers: list[ConsumerInfo] = field(default_factory=list)

    def __post_init__(self):
        if not self.date_generated:
            self.date_generated = datetime.now(timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S+00:00"
            )


_TEMPLATE = """<!DOCTYPE html>
<html lang="en" theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="dark" id="meta-color-scheme">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{service_name} — API Contract Change Report</title>
    <style>
        :root {{
            --bg: #0d1117;
            --bg-card: #161b22;
            --bg-hover: #161b22;
            --text: #e6edf3;
            --text-heading: #f0f6fc;
            --text-muted: #8b949e;
            --border: #30363d;
            --border-row: #21262d;
            --footer: #484f58;
            --critical: #f85149;
            --warning: #d29922;
            --info: #58a6ff;
            --green: #238636;
            --green-bg: rgba(35, 134, 54, 0.1);
            --green-border: rgba(35, 134, 54, 0.3);
            --red-bg: rgba(248, 81, 73, 0.1);
            --red-border: rgba(248, 81, 73, 0.3);
            --yellow-bg: rgba(210, 153, 34, 0.1);
            --yellow-border: rgba(210, 153, 34, 0.3);
            --blue-bg: rgba(88, 166, 255, 0.15);
            --btn-inactive: rgba(255,255,255,0.05);
            --code-bg: #0d1117;
            --tag-bg: rgba(255,255,255,0.03);
        }}

        [theme="light"] {{
            --bg: #ffffff;
            --bg-card: #f6f8fa;
            --bg-hover: #f6f8fa;
            --text: #1f2328;
            --text-heading: #1f2328;
            --text-muted: #656d76;
            --border: #d0d7de;
            --border-row: #d8dee4;
            --footer: #8c959f;
            --green: #1a7f37;
            --critical: #cf222e;
            --warning: #9a6700;
            --info: #0969da;
            --green-bg: rgba(26, 127, 55, 0.1);
            --green-border: rgba(26, 127, 55, 0.3);
            --red-bg: rgba(207, 34, 46, 0.08);
            --red-border: rgba(207, 34, 46, 0.3);
            --yellow-bg: rgba(154, 103, 0, 0.08);
            --yellow-border: rgba(154, 103, 0, 0.3);
            --blue-bg: rgba(9, 105, 218, 0.12);
            --btn-inactive: rgba(0,0,0,0.04);
            --code-bg: #f6f8fa;
            --tag-bg: rgba(0,0,0,0.03);
        }}

        * {{ margin: 0; padding: 0; box-sizing: border-box; }}

        body {{
            background: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            padding: 32px 24px;
            transition: background .15s, color .15s;
        }}

        .container {{ max-width: 960px; margin: 0 auto; }}

        /* ── Theme toggle ── */
        .theme-toggle {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 13px;
            color: var(--text-muted);
            cursor: pointer;
            margin-left: auto;
        }}
        .theme-toggle:hover {{ border-color: var(--text-muted); }}

        /* ── Header ── */
        .header {{
            border-bottom: 1px solid var(--border);
            padding-bottom: 24px;
            margin-bottom: 24px;
        }}

        .header-row {{
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }}

        .header h1 {{ font-size: 20px; font-weight: 600; color: var(--text-heading); }}
        .meta {{ color: var(--text-muted); font-size: 13px; margin-top: 4px; }}

        .badge {{
            display: inline-block;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}

        .badge-breaking {{ background: var(--critical); color: #fff; }}
        .badge-compatible {{ background: var(--green); color: #fff; }}

        /* ── Summary cards ── */
        .summary {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 32px;
        }}

        .summary-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }}

        .summary-card .count {{ font-size: 28px; font-weight: 700; line-height: 1.2; }}
        .summary-card .count.critical {{ color: var(--critical); }}
        .summary-card .count.warning {{ color: var(--warning); }}
        .summary-card .count.info {{ color: var(--info); }}
        .summary-card .count.total {{ color: var(--text-heading); }}

        .summary-card .label {{
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 4px;
        }}

        /* ── Version suggestion ── */
        .version-suggestion {{
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-size: 13px;
            font-weight: 600;
        }}

        .version-major {{ background: var(--red-bg); border: 1px solid var(--red-border); color: var(--critical); }}
        .version-minor {{ background: var(--yellow-bg); border: 1px solid var(--yellow-border); color: var(--warning); }}
        .version-patch {{ background: var(--blue-bg); border: 1px solid rgba(88, 166, 255, 0.3); color: var(--info); }}

        /* ── Filter bar ── */
        .filter-bar {{
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }}

        .filter-btn {{
            padding: 4px 14px;
            border-radius: 20px;
            border: 1px solid var(--border);
            background: var(--btn-inactive);
            color: var(--text-muted);
            font-size: 13px;
            cursor: pointer;
            transition: all .12s;
        }}

        .filter-btn:hover {{ border-color: var(--text-muted); color: var(--text); }}
        .filter-btn.active {{
            background: var(--blue-bg);
            border-color: var(--info);
            color: var(--info);
            font-weight: 600;
        }}

        .filter-btn.active-btn-all {{ background: var(--tag-bg); border-color: var(--text-muted); color: var(--text); font-weight: 600; }}

        .filter-btn.count-critical {{ color: var(--critical); }}
        .filter-btn.count-critical.active {{ background: var(--red-bg); border-color: var(--critical); color: var(--critical); }}
        .filter-btn.count-warning {{ color: var(--warning); }}
        .filter-btn.count-warning.active {{ background: var(--yellow-bg); border-color: var(--warning); color: var(--warning); }}
        .filter-btn.count-info {{ color: var(--info); }}
        .filter-btn.count-info.active {{ background: var(--blue-bg); border-color: var(--info); color: var(--info); }}

        .filter-btn .count-badge {{
            display: inline-block;
            margin-left: 4px;
            font-size: 11px;
            opacity: 0.7;
        }}

        /* ── Changes table ── */
        .section-title {{ font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--text-heading); }}

        .changes-table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 32px;
        }}

        .changes-table th {{
            text-align: left;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            border-bottom: 2px solid var(--border);
        }}

        .changes-table td {{
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-row);
            vertical-align: top;
        }}

        .changes-table .change-row:hover td {{ background: var(--bg-hover); cursor: pointer; }}
        .changes-table .change-row.expanded td {{ background: var(--bg-hover); }}

        .severity-tag {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }}

        .severity-tag.critical {{ background: var(--red-bg); color: var(--critical); }}
        .severity-tag.warning {{ background: var(--yellow-bg); color: var(--warning); }}
        .severity-tag.info {{ background: var(--blue-bg); color: var(--info); }}

        .category-tag {{ color: #7ee787; font-weight: 500; }}
        [theme="light"] .category-tag {{ color: #1a7f37; }}

        .change-desc {{ color: var(--text-muted); font-size: 13px; }}

        .no-changes {{
            text-align: center;
            padding: 32px;
            color: var(--text-muted);
            font-size: 15px;
        }}

        .no-changes-icon {{ font-size: 32px; margin-bottom: 12px; }}

        /* ── Diff expand ── */
        .diff-row {{ display: none; }}
        .change-row.expanded + .diff-row {{ display: table-row; }}
        .diff-cell {{
            padding: 12px 16px;
            background: var(--code-bg);
            border-bottom: 1px solid var(--border);
        }}

        .diff-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }}

        .diff-panel {{
            background: var(--tag-bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            overflow: hidden;
        }}

        .diff-panel-header {{
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 1px solid var(--border);
        }}

        .diff-panel-header.old {{ color: var(--critical); background: var(--red-bg); }}
        .diff-panel-header.new {{ color: var(--green); background: var(--green-bg); }}

        .diff-panel pre {{
            padding: 8px 10px;
            font-family: 'SF Mono', ui-monospace, monospace;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-all;
            margin: 0;
            color: var(--text);
        }}

        .expand-icon {{
            display: inline-block;
            width: 16px;
            text-align: center;
            transition: transform .12s;
            color: var(--text-muted);
        }}

        .change-row.expanded .expand-icon {{ transform: rotate(90deg); }}

        /* ── Row hidden by filter ── */
        .change-row.filtered-out {{ display: none; }}

        /* ── Consumers ── */
        .consumers {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 32px;
        }}

        .consumers h3 {{ font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-heading); }}

        .consumer-chip {{
            display: inline-block;
            padding: 4px 12px;
            background: var(--yellow-bg);
            border: 1px solid var(--yellow-border);
            border-radius: 16px;
            font-size: 13px;
            color: var(--warning);
            margin-right: 8px;
            margin-bottom: 8px;
        }}

        /* ── Footer ── */
        .footer {{
            border-top: 1px solid var(--border);
            padding-top: 16px;
            font-size: 12px;
            color: var(--footer);
        }}

        .footer a {{ color: var(--info); text-decoration: none; }}

        /* ── Responsive ── */
        @media (max-width: 640px) {{
            .summary {{ grid-template-columns: repeat(2, 1fr); }}
            .header h1 {{ font-size: 16px; }}
            .diff-grid {{ grid-template-columns: 1fr; }}
        }}
    </style>
</head>
<body>
<div class="container">
    {header_html}
    {summary_html}
    {version_html}
    {changes_html}
    {consumers_html}
    {footer_html}
</div>
<script type="application/json" id="report-data">{report_json}</script>
<script>
(function() {{
    var data = JSON.parse(document.getElementById('report-data').textContent);

    // ── Theme toggle ──
    var html = document.documentElement;
    var metaCS = document.getElementById('meta-color-scheme');
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {{
        toggle.addEventListener('click', function() {{
            var next = html.getAttribute('theme') === 'dark' ? 'light' : 'dark';
            html.setAttribute('theme', next);
            metaCS.setAttribute('content', next);
            toggle.textContent = next === 'dark' ? '\\ud83c\\udf19 Dark' : '\\u2600\\ufe0f Light';
        }});
    }}

    // ── Filter buttons ──
    var filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
    var rows = document.querySelectorAll('.change-row');
    filterBtns.forEach(function(btn) {{
        btn.addEventListener('click', function() {{
            var filter = btn.getAttribute('data-filter');
            filterBtns.forEach(function(b) {{ b.classList.remove('active'); }});
            btn.classList.add('active');
            rows.forEach(function(row) {{
                if (filter === 'all') {{
                    row.classList.remove('filtered-out');
                }} else {{
                    var sev = row.getAttribute('data-severity');
                    if (sev === filter) {{
                        row.classList.remove('filtered-out');
                    }} else {{
                        row.classList.add('filtered-out');
                    }}
                }}
            }});
        }});
    }});

    // ── Diff expand ──
    rows.forEach(function(row) {{
        row.addEventListener('click', function() {{
            row.classList.toggle('expanded');
        }});
    }});
}})();
</script>
</body>
</html>
"""


class HTMLReportRenderer:
    """Generates a self-contained HTML report from change data."""

    def render(self, data: ReportData) -> str:
        header_html = self._build_header(data)
        summary_html = self._build_summary(data)
        version_html = self._build_version_suggestion(data)
        changes_html = self._build_changes(data)
        consumers_html = self._build_consumers(data)
        footer_html = self._build_footer(data)
        report_json = self._serialize_data(data)

        return _TEMPLATE.format(
            service_name=self._esc(data.service_name),
            header_html=header_html,
            summary_html=summary_html,
            version_html=version_html,
            changes_html=changes_html,
            consumers_html=consumers_html,
            footer_html=footer_html,
            report_json=report_json,
        )

    def to_file(self, data: ReportData, path: str) -> None:
        html = self.render(data)
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

    # ── Section builders ──

    def _build_header(self, data: ReportData) -> str:
        badge = "badge-breaking" if not data.compatible else "badge-compatible"
        label = "BREAKING" if not data.compatible else "COMPATIBLE"
        return (
            '<div class="header">'
            '<div class="header-row">'
            f"<h1>{self._esc(data.service_name)} v{self._esc(data.version)}</h1>"
            f'<span class="badge {badge}">{label}</span>'
            '<button class="theme-toggle" id="theme-toggle">\U0001f319 Dark</button>'
            "</div>"
            f'<div class="meta">Generated: {data.date_generated} \u00b7 {len(data.changes)} changes</div>'
            "</div>"
        )

    def _build_summary(self, data: ReportData) -> str:
        counts = {"critical": 0, "warning": 0, "info": 0}
        for c in data.changes:
            sev = str(c.severity.value) if hasattr(c.severity, "value") else str(c.severity)
            if sev in counts:
                counts[sev] += 1
        total = len(data.changes)

        def card(cls: str, count: int, label: str) -> str:
            return (
                '<div class="summary-card">'
                f'<div class="count {cls}">{count}</div>'
                f'<div class="label">{label}</div>'
                "</div>"
            )

        return (
            '<div class="summary">'
            + card("total", total, "Total Changes")
            + card("critical", counts["critical"], "Critical")
            + card("warning", counts["warning"], "Warnings")
            + card("info", counts["info"], "Info")
            + "</div>"
        )

    def _build_version_suggestion(self, data: ReportData) -> str:
        has_breaking = any(
            (hasattr(c.severity, "value") and c.severity.value == "critical")
            or (not hasattr(c.severity, "value") and c.severity == "critical")
            for c in data.changes
        )
        has_additions = any(
            (hasattr(c.category, "value") and c.category.value in ("field_added", "endpoint_added"))
            or (not hasattr(c.category, "value") and c.category in ("field_added", "endpoint_added"))
            for c in data.changes
        )

        if has_breaking:
            cls = "version-major"
            text = "\U0001f6a8 Major version bump recommended (breaking changes)"
        elif has_additions:
            cls = "version-minor"
            text = "\U0001f4c8 Minor version bump recommended (additions)"
        else:
            cls = "version-patch"
            text = "\U0001f527 Patch version bump recommended"

        return f'<div class="version-suggestion {cls}">{text}</div>'

    def _build_changes(self, data: ReportData) -> str:
        if not data.changes:
            return (
                '<div class="no-changes">'
                '<div class="no-changes-icon">\u2705</div>'
                "<div>No changes detected \u2014 the specification is identical.</div>"
                "</div>"
            )

        # Counts for filter badges
        counts: dict[str, int] = {"critical": 0, "warning": 0, "info": 0}
        for c in data.changes:
            sev = str(c.severity.value) if hasattr(c.severity, "value") else str(c.severity)
            if sev in counts:
                counts[sev] += 1

        # Filter bar
        def _fbtn(label: str, filter_val: str, extra_cls: str = "", badge: str = "") -> str:
            count_attr = f' data-count="{badge}"' if badge else ""
            return (
                f'<button class="filter-btn{extra_cls}" data-filter="{filter_val}"{count_attr}>'
                f"{label}"
                f'<span class="count-badge">{badge}</span>' if badge else f"{label}"
                f"</button>"
            )

        filter_bar = (
            '<div class="filter-bar">'
            f'<button class="filter-btn active" data-filter="all">All</button>'
            f'<button class="filter-btn count-critical" data-filter="critical">{counts["critical"]} Critical</button>'
            f'<button class="filter-btn count-warning" data-filter="warning">{counts["warning"]} Warnings</button>'
            f'<button class="filter-btn count-info" data-filter="info">{counts["info"]} Info</button>'
            "</div>"
        )

        rows = ""
        diffs = ""
        for c in data.changes:
            cat = str(c.category.value) if hasattr(c.category, "value") else str(c.category)
            sev = str(c.severity.value) if hasattr(c.severity, "value") else str(c.severity)
            category_label = cat.replace("_", " ")

            has_diff = bool(c.old_value) or bool(c.new_value)

            rows += (
                f'<tr class="change-row" data-severity="{sev}"{" data-has-diff" if has_diff else ""}>'
                f'<td><span class="category-tag">{self._esc(category_label)}</span></td>'
                f'<td><span class="severity-tag {sev}">{sev}</span></td>'
                f"<td>"
                f'<span class="expand-icon">{">" if has_diff else ""}</span> '
                f'<span class="change-desc">{self._esc(self._format_description(c))}</span>'
                f"</td>"
                "</tr>"
            )

            if has_diff:
                diffs += (
                    f'<tr class="diff-row" data-severity="{sev}">'
                    f'<td colspan="3" class="diff-cell">'
                    f'{self._build_diff(c)}'
                    f"</td>"
                    f"</tr>"
                )

        return (
            f'<div class="section-title">\U0001f4cb Changes</div>'
            f"{filter_bar}"
            f'<table class="changes-table">'
            f"<thead><tr><th>Category</th><th>Severity</th><th>Description</th></tr></thead>"
            f"<tbody>{rows}{diffs}</tbody>"
            f"</table>"
        )

    def _build_diff(self, c: Change) -> str:
        """Build a side-by-side old → new diff for a change."""
        old = c.old_value or ""
        new = c.new_value or ""
        return (
            '<div class="diff-grid">'
            '<div class="diff-panel">'
            '<div class="diff-panel-header old">\u2716 Old</div>'
            f"<pre>{self._esc(old)}</pre>"
            "</div>"
            '<div class="diff-panel">'
            '<div class="diff-panel-header new">\u2714 New</div>'
            f"<pre>{self._esc(new)}</pre>"
            "</div>"
            "</div>"
        )

    def _build_consumers(self, data: ReportData) -> str:
        if not data.affected_consumers:
            return ""

        chips = "".join(
            f'<span class="consumer-chip">\u26a0 {self._esc(c.name)}</span>'
            for c in data.affected_consumers
        )
        return (
            '<div class="consumers">'
            f"<h3>\U0001f4e2 Affected Consumers ({len(data.affected_consumers)})</h3>"
            f"{chips}"
            "</div>"
        )

    def _build_footer(self, data: ReportData) -> str:
        return (
            '<div class="footer">'
            f'Generated by <a href="#">API Contract Platform</a> \u00b7 {data.date_generated}'
            "</div>"
        )

    # ── Helpers ──

    @staticmethod
    def _format_description(c: Change) -> str:
        """Build a natural-language description from a Change object."""
        import json as _json

        cat = str(c.category.value) if hasattr(c.category, "value") else str(c.category)
        desc = c.description

        # Parse the human path + action from the description
        action = ""
        for suffix in [" was removed", " was added", " changed from "]:
            idx = desc.find(suffix)
            if idx != -1:
                human_path = desc[:idx]
                action = desc[idx:].strip()
                break
        else:
            return desc  # fallback

        # Try to parse old/new_value for type info
        def _extract_type(raw: str) -> str:
            """Extract type name from a stringified dict like \"{'type': 'array'}\"."""
            if not raw:
                return ""
            try:
                val = _json.loads(raw.replace("'", '"'))
                if isinstance(val, dict):
                    t = val.get("type", "")
                    fmt = val.get("format", "")
                    items = val.get("items", {})
                    if items and isinstance(items, dict) and items.get("type"):
                        t = f"{t}<{items['type']}>"
                    return f" ({t})" if not fmt else f" ({t}, format: {fmt})"
            except (_json.JSONDecodeError, TypeError):
                pass
            # Fallback: try to find 'type' in the raw string
            import re as _re
            m = _re.search(r"'type':\s*'([^']+)'", raw)
            return f" ({m.group(1)})" if m else ""

        if cat == "field_added":
            # "Schema Pet → tags was added" + new_value = "{'type': 'array'}"
            if " → " in human_path:
                parts = human_path.split(" → ")
                schema = parts[0].replace("Schema ", "") if parts[0].startswith("Schema ") else parts[0]
                field = parts[-1]
                type_info = _extract_type(c.new_value)
                return f"Field `{field}`{type_info} was added to schema `{schema}`"
            return desc

        if cat == "field_removed":
            if " → " in human_path:
                parts = human_path.split(" → ")
                schema = parts[0].replace("Schema ", "") if parts[0].startswith("Schema ") else parts[0]
                field = parts[-1]
                return f"Field `{field}` was removed from schema `{schema}`"
            return desc

        if cat == "endpoint_removed":
            return f"Endpoint `{human_path}` was removed"

        if cat == "endpoint_added":
            return f"Endpoint `{human_path}` was added"

        if cat == "type_changed":
            # "Schema Pet → field changed from oldtype to newtype"
            if " → " in human_path:
                parts = human_path.split(" → ")
                schema = parts[0].replace("Schema ", "") if parts[0].startswith("Schema ") else parts[0]
                field = parts[-1]
                old_t = _extract_type(c.old_value) or ""
                new_t = _extract_type(c.new_value) or ""
                # If extract_type returned nothing, use action text
                if old_t or new_t:
                    return f"Field `{field}` in schema `{schema}` changed type{old_t} →{new_t}"
            return desc

        return desc

    def _esc(self, s: str) -> str:
        if not isinstance(s, str):
            return ""
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    def _serialize_data(self, data: ReportData) -> str:
        raw = {
            "serviceName": data.service_name,
            "version": data.version,
            "dateGenerated": data.date_generated,
            "compatible": data.compatible,
            "changes": [
                {
                    "category": str(c.category.value) if hasattr(c.category, "value") else str(c.category),
                    "severity": str(c.severity.value) if hasattr(c.severity, "value") else str(c.severity),
                    "path": c.path,
                    "description": c.description,
                    "oldValue": c.old_value,
                    "newValue": c.new_value,
                }
                for c in data.changes
            ],
            "affectedConsumers": [{"id": c.id, "name": c.name} for c in data.affected_consumers],
        }
        return json.dumps(raw, ensure_ascii=False)
