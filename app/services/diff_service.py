import re
from deepdiff import DeepDiff
from app.domain.dto.common import Change
from app.domain.dto.enums import ChangeCategory, Severity


def _humanize_path(raw: str) -> str:
    """Convert a DeepDiff tree path like `root['paths']['/pets']['post']`
    into a human-readable form like `POST /pets`.

    Examples:
        root['paths']['/pets']['post']           → POST /pets
        root['paths']['/pets/{petId}']            → /pets/{petId} (all methods)
        root['paths']['/pets']['get']['responses']['200'] → GET /pets → responses → 200
        root['components']['schemas']['Pet']       → Schema Pet
    """
    cleaned = raw.removeprefix('root').lstrip('[')
    segments = re.findall(r"\['([^']+)'\]", f"[{cleaned}")

    if not segments:
        return raw

    if segments[0] == 'paths':
        path_parts = segments[1:]

        if not path_parts:
            return "paths"

        api_path = path_parts[0]

        if len(path_parts) == 1:
            return f"{api_path} (all methods)"

        method = path_parts[1].upper()
        human = f"{method} {api_path}"
        tail = path_parts[2:]

        for tok in tail:
            if tok in ('content', 'schema', 'properties', 'items', 'allOf', 'oneOf', 'anyOf'):
                continue
            if tok.startswith('application/') or tok in ('json', 'xml', 'form-data', 'x-www-form-urlencoded', 'octet-stream', 'text', 'plain', 'html'):
                continue
            human += f" → {tok}"
        return human

    if len(segments) >= 2 and segments[0] == 'components' and segments[1] == 'schemas':
        schema_name = segments[2] if len(segments) > 2 else '?'
        human = f"Schema {schema_name}"
        tail = segments[3:]
        for tok in tail:
            if tok in ('properties', 'content', 'schema', 'items', 'allOf', 'oneOf', 'anyOf'):
                continue
            if tok.startswith('application/') or tok in ('json', 'xml', 'form-data', 'x-www-form-urlencoded', 'octet-stream', 'text', 'plain', 'html'):
                continue
            human += f" → {tok}"
        return human

    return '.'.join(segments)


class DiffService:
    async def diff(self, old_spec: dict, new_spec: dict) -> list[Change]:
        diff = DeepDiff(old_spec, new_spec, view='tree', verbose_level=2).to_dict()
        changes = []
        for category, items in diff.items():
            for path, details in items.items():
                human = _humanize_path(path)

                # OpenAPI хранит `required` и `enum` как массивы, поэтому DeepDiff
                # репортит изменения в них как iterable_item_*, а не values_changed.
                # Эти ветки ловят два классических breaking change, которые иначе
                # проходят мимо: появление нового обязательного поля и удаление
                # допустимого значения из enum.
                if category in ('iterable_item_added', 'iterable_item_removed'):
                    value = str(details)
                    if "['required']" in path and category == 'iterable_item_added':
                        changes.append(Change(
                            category=ChangeCategory.required_added,
                            severity=Severity.critical,
                            path=path,
                            description=f"{human} → field '{value}' is now required",
                            old_value='',
                            new_value=value,
                            recommendation='Notify consumers about this change',
                        ))
                    elif "['enum']" in path and category == 'iterable_item_removed':
                        changes.append(Change(
                            category=ChangeCategory.enum_value_removed,
                            severity=Severity.critical,
                            path=path,
                            description=f"{human} value '{value}' was removed",
                            old_value=value,
                            new_value='',
                            recommendation='Notify consumers about this change',
                        ))
                    # remove from required / add to enum ослабляют контракт — не breaking
                    continue

                if 'paths' in path:
                    if category == 'dictionary_item_removed':
                        change_category = ChangeCategory.endpoint_removed
                    elif category == 'dictionary_item_added':
                        change_category = ChangeCategory.endpoint_added
                    else:
                        continue
                elif 'type' in path and category == 'values_changed':
                    change_category = ChangeCategory.type_changed
                elif 'properties' in path and category == 'dictionary_item_removed':
                    change_category = ChangeCategory.field_removed
                elif 'properties' in path and category == 'dictionary_item_added':
                    change_category = ChangeCategory.field_added
                elif 'format' in path and category == 'values_changed':
                    change_category = ChangeCategory.format_changed
                elif 'nullable' in path and category == 'values_changed':
                    change_category = ChangeCategory.nullable_changed
                else:
                    continue

                if change_category in (ChangeCategory.endpoint_removed, ChangeCategory.field_removed, ChangeCategory.type_changed):
                    severity = Severity.critical
                elif change_category in (ChangeCategory.format_changed, ChangeCategory.nullable_changed):
                    severity = Severity.warning
                else:
                    severity = Severity.info

                if category == 'values_changed':
                    description = f"{human} changed from {details['old_value']} to {details['new_value']}"
                    old_value = str(details['old_value'])
                    new_value = str(details['new_value'])
                elif category == 'dictionary_item_removed':
                    description = f"{human} was removed"
                    old_value = str(details)
                    new_value = ''
                elif category == 'dictionary_item_added':
                    description = f"{human} was added"
                    old_value = ''
                    new_value = str(details)

                changes.append(Change(
                    category=change_category,
                    severity=severity,
                    path=path,
                    description=description,
                    old_value=old_value,
                    new_value=new_value,
                    recommendation='Notify consumers about this change'
                ))
        return changes
