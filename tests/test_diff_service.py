
import asyncio

from app.services.diff_service import DiffService
from app.domain.dto.enums import ChangeCategory, Severity


def run_diff(old: dict, new: dict):
    return asyncio.run(DiffService().diff(old, new))


def categories(changes):
    return {c.category for c in changes}


def by_category(changes, category):
    return [c for c in changes if c.category == category]


def is_compatible(changes):
    """Та же логика, что в схеме DiffResponse / check_service."""
    return all(c.severity != Severity.critical for c in changes)


def _schema(required, props):
    return {"components": {"schemas": {"Pet": {
        "type": "object", "required": required, "properties": props,
    }}}}


#breaking changes из массивов 

def test_new_required_field_is_critical():
    old = _schema(["id"], {"id": {"type": "integer"}})
    new = _schema(["id", "name"], {"id": {"type": "integer"},
                                   "name": {"type": "string"}})
    changes = run_diff(old, new)
    required = by_category(changes, ChangeCategory.required_added)
    assert len(required) == 1
    assert required[0].severity == Severity.critical
    assert "name" in required[0].new_value
    assert not is_compatible(changes)


def test_removed_enum_value_is_critical():
    old = _schema(["id"], {"status": {"type": "string",
                                      "enum": ["available", "pending", "sold"]}})
    new = _schema(["id"], {"status": {"type": "string",
                                      "enum": ["available", "pending"]}})
    changes = run_diff(old, new)
    enum = by_category(changes, ChangeCategory.enum_value_removed)
    assert len(enum) == 1
    assert enum[0].severity == Severity.critical
    assert enum[0].old_value == "sold"
    assert not is_compatible(changes)


#не-breaking changes остаются совместимыми

def test_optional_field_added_is_compatible():
    old = _schema(["id"], {"id": {"type": "integer"}})
    new = _schema(["id"], {"id": {"type": "integer"},
                           "email": {"type": "string"}})
    changes = run_diff(old, new)
    assert ChangeCategory.required_added not in categories(changes)
    assert is_compatible(changes)


def test_added_enum_value_is_compatible():
    old = _schema(["id"], {"status": {"type": "string", "enum": ["a", "b"]}})
    new = _schema(["id"], {"status": {"type": "string", "enum": ["a", "b", "c"]}})
    changes = run_diff(old, new)
    assert ChangeCategory.enum_value_removed not in categories(changes)
    assert is_compatible(changes)

#ранее работавшее не ломалось

def test_endpoint_removed_is_critical():
    old = {"paths": {"/pets": {"get": {"responses": {"200": {}}}}}}
    new = {"paths": {}}
    changes = run_diff(old, new)
    removed = by_category(changes, ChangeCategory.endpoint_removed)
    assert len(removed) == 1
    assert removed[0].severity == Severity.critical


def test_type_changed_is_critical():
    old = _schema(["id"], {"id": {"type": "integer"}})
    new = _schema(["id"], {"id": {"type": "string"}})
    changes = run_diff(old, new)
    type_changes = by_category(changes, ChangeCategory.type_changed)
    assert len(type_changes) == 1
    assert type_changes[0].severity == Severity.critical


def test_identical_specs_produce_no_changes():
    spec = _schema(["id"], {"id": {"type": "integer"}})
    assert run_diff(spec, spec) == []
