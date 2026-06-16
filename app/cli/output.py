RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
GREEN = "\033[92m"
BOLD = "\033[1m"
RESET = "\033[0m"

SEVERITY_COLORS = {
    "critical": RED,
    "warning": YELLOW,
    "info": BLUE,
}


def print_changes(changes: list) -> None:
    if not changes:
        print(f"{GREEN}✅ Compatible — no changes detected{RESET}")
        return

    critical = sum(1 for c in changes if c.severity.value == "critical")
    warning = sum(1 for c in changes if c.severity.value == "warning")
    info = sum(1 for c in changes if c.severity.value == "info")

    print()
    print(f"{BOLD}{'Категория':30} {'Severity':12} Описание{RESET}")
    print(f"{'─' * 30} {'─' * 12} {'─' * 40}")

    for c in changes:
        color = SEVERITY_COLORS.get(c.severity.value, RESET)
        sev = c.severity.value.upper()
        print(f"{c.category.value:30} {color}{sev:12}{RESET} {c.description}")

    print()
    print(f"Итого: {len(changes)} changes · {RED}{critical} critical{RESET}, "
          f"{YELLOW}{warning} warning{RESET}, {BLUE}{info} info{RESET}")
    print()
