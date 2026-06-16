from enum import StrEnum

class CheckStatus(StrEnum):
    queued = 'queued'
    processing = 'processing'
    completed = 'completed'
    failed = 'failed'

class Severity(StrEnum):
    critical = 'critical'
    warning = 'warning'
    info = 'info'

class ChangeCategory(StrEnum):
    endpoint_removed = 'endpoint_removed'
    field_removed = 'field_removed'
    type_changed = 'type_changed'
    required_added = 'required_added'
    enum_value_removed = 'enum_value_removed'
    field_added = 'field_added'
    endpoint_added = 'endpoint_added'
    format_changed = 'format_changed'
    nullable_changed = 'nullable_changed'
    deprecated_added = 'deprecated_added'