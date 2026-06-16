import argparse
import sys
import json
import yaml
from app.cli.diff import diff as diff_command
from app.cli.fetch import fetch_spec_from_url
from app.cli.push import handle_push
from app.cli.ps import handle_ps
from app.cli.check import handle_check
from app.cli.output import print_changes
from app.services.diff_service import DiffService


DEFAULT_SERVER = "http://localhost:8000"


def _parse_headers(raw: list[str]) -> dict[str, str]:
    """Convert list of "Key: Value" strings into a dict."""
    headers: dict[str, str] = {}
    for item in raw:
        if ":" not in item:
            raise ValueError(f"Invalid header format: {item!r} (expected 'Key: Value')")
        key, _, value = item.partition(":")
        headers[key.strip()] = value.strip()
    return headers


def read_spec(path: str) -> dict:
    with open(path) as f:
        if path.endswith(('.yaml', '.yml')):
            return yaml.safe_load(f)
        elif path.endswith('.json'):
            return json.load(f)
        else:
            raise ValueError(f'Unsupported format: {path}')


def main():
    parser = argparse.ArgumentParser(prog='api-contract')
    subparsers = parser.add_subparsers(dest='command', required=True)

    diff_parser = subparsers.add_parser('diff', help='compare two OpenAPI specs')
    diff_parser.add_argument('old_file', help='path to old spec file')
    diff_parser.add_argument('new_file', help='path to new spec file')
    diff_parser.add_argument('--html', help='path to save HTML report')

    push_parser = subparsers.add_parser('push', help='upload spec to platform')
    push_parser.add_argument('spec_file', help='path to OpenAPI spec file or URL (e.g., http://service:8000)')
    push_parser.add_argument('--service', required=True, help='service name')
    push_parser.add_argument('--version', help='version (default: from spec info.version)')
    push_parser.add_argument('--server', default=DEFAULT_SERVER, help=f'platform URL (default: {DEFAULT_SERVER})')
    push_parser.add_argument('--header', '-H', action='append', default=[],
                            help='custom HTTP header for spec URL (can be repeated, e.g. -H "Authorization: Bearer $TOKEN")')
    push_parser.add_argument('--html', help='path to save HTML report')

    ps_parser = subparsers.add_parser('ps', help='list all services')
    ps_parser.add_argument('--server', default=DEFAULT_SERVER, help=f'platform URL (default: {DEFAULT_SERVER})')

    check_parser = subparsers.add_parser('check', help='run compatibility check')
    check_parser.add_argument('service_id', help='service ID (UUID)')
    check_parser.add_argument('version', help='version to check')
    check_parser.add_argument('--server', default=DEFAULT_SERVER, help=f'platform URL (default: {DEFAULT_SERVER})')
    check_parser.add_argument('--html', help='path to save HTML report')

    args = parser.parse_args()

    if args.command == 'diff':
        old_spec = read_spec(args.old_file)
        new_spec = read_spec(args.new_file)
        changes = diff_command(DiffService(), old_spec, new_spec, html_path=args.html)
        print_changes(changes)

        if any(c.severity.value == "critical" for c in changes):
            sys.exit(1)
        sys.exit(0)

    elif args.command == 'push':
        if args.spec_file.startswith(("http://", "https://")):
            headers = _parse_headers(args.header)
            spec = fetch_spec_from_url(args.spec_file, headers=headers)
        else:
            spec = read_spec(args.spec_file)
        version = args.version or spec.get("info", {}).get("version", "0.0.0")
        handle_push(spec, args.service, version, args.server, html_path=args.html)

    elif args.command == 'ps':
        handle_ps(args.server)

    elif args.command == 'check':
        handle_check(args.service_id, args.version, args.server, html_path=args.html)


if __name__ == '__main__':
    main()
