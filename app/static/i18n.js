/* ========================================
   i18n — English / Русский
   ======================================== */

const LOCALE_STORAGE_KEY = "acp_locale";

const translations = {
    en: {
        // Navigation
        "nav.dashboard": "Dashboard",
        "nav.services": "Services",
        "nav.dependencies": "Dependencies",
        "nav.checks": "Checks",
        "nav.settings": "Settings",
        "nav.main": "Main",
        "nav.services_title": "Services",

        // Stats
        "stats.services": "Services",
        "stats.dependencies": "Dependencies",
        "stats.compatible": "Compatible",
        "stats.breaking": "Breaking",

        // Dependencies
        "deps.empty": "No dependencies found.",

        // Graph controls
        "graph.auto": "Auto",
        "graph.fit": "Fit",
        "graph.reset": "Reset",

        // Header
        "app.title": "ApiHub",
        "btn.refresh": "Refresh",
        "btn.check": "Run Check",

        // Schemas table
        "schemas.title": "Schemas",
        "table.service": "Service",
        "table.version": "Version",
        "table.role": "Role",
        "table.depends_on": "Depends On",
        "table.used_by": "Used By",
        "table.created": "Created",
        "table.id": "ID",
        "schemas.empty": "No schemas yet. Create one via API.",

        // Graph
        "graph.title": "Services",
        "graph.empty": "No services to show in graph.",
        "graph.loading": "Loading graph…",
        "graph.connections": "Connections: {{count}}",
        "graph.library_error": "Could not load graph library. Check your internet connection.",

        // Legend (simple names)
        "legend.api": "API",
        "legend.client": "Client",
        "legend.both": "API + Client",
        "legend.selected": "Selected",
        "legend.none": "Standalone",

        // Details panel
        "details.clients": "Clients",
        "details.apis": "APIs",
        "details.latest": "Latest version",
        "details.no_deps": "No dependencies linked to this service.",
        "details.check_btn": "Check New Version",
        "details.recent_checks": "Recent Checks",
        "details.dependency": "Dependency",
        "details.client": "Client",
        "details.api": "API",
        "details.constraint": "Constraint",

        // Contract view
        "contract.provider_defines": "What API provides",
        "contract.consumer_expects": "What Client expects",
        "contract.client_sends": "What Client sends",
        "contract.api_expects": "What API expects",
        "contract.api_returns": "What API returns",
        "contract.client_receives": "What Client receives",
        "contract.provider_only": "Only in API spec",
        "contract.consumer_only": "Only in Client spec",
        "contract.type_mismatch": "Type mismatch",
        "contract.matched": "matched",
        "contract.provider_only_badge": "provider only",
        "contract.parameters": "Parameters",
        "contract.request_body": "Request Body",
        "contract.responses": "Responses",

        // Check modal
        "check.title": "Run Compatibility Check",
        "check.service_label": "Service",
        "check.select_placeholder": "— Select service —",
        "check.version_label": "New Version",
        "check.latest_hint": "Latest version",
        "check.cancel": "Cancel",
        "check.submit": "Run Check",
        "check.running": "Running compatibility check…",
        "check.fetching": "Fetching results…",

        // Check results
        "check.compatible": "Compatible",
        "check.breaking": "Breaking Change",
        "check.changes_title": "Changes",
        "check.consumers_title": "Affected Clients",
        "check.pending": "Check is pending…",
        "check.severity_critical": "critical",
        "check.severity_major": "major",
        "check.severity_minor": "minor",
        "check.version_major": "Major version bump recommended — breaking changes detected",
        "check.version_minor": "Minor version bump — additive changes only",
        "check.version_patch": "Patch version — internal changes only",

        // Recent checks
        "checks.title": "Recent Checks",
        "checks.empty": "No checks run yet.",

        // General
        "loading": "Loading…",
        "active": "active",
        "change": "change",
        "changes": "changes",
        "consumer": "client",
        "consumers": "clients",
        "affected": "affected",
        "compatible_label": "Compatible",
        "breaking_label": "Breaking",
        "pending": "Pending",
        "error_prefix": "Error",
        "general.status": "Status",
    },

    ru: {
        // Navigation
        "nav.dashboard": "Дашборд",
        "nav.services": "Сервисы",
        "nav.dependencies": "Зависимости",
        "nav.checks": "Проверки",
        "nav.settings": "Настройки",
        "nav.main": "Основное",
        "nav.services_title": "Сервисы",

        // Stats
        "stats.services": "Сервисы",
        "stats.dependencies": "Зависимости",
        "stats.compatible": "Совместимо",
        "stats.breaking": "Ломающих",

        // Dependencies
        "deps.empty": "Зависимостей не найдено.",

        // Graph controls
        "graph.auto": "Авто",
        "graph.fit": "По размеру",
        "graph.reset": "Сброс",

        // Header
        "app.title": "ApiHub",
        "btn.refresh": "Обновить",
        "btn.check": "Проверить",

        // Schemas table
        "schemas.title": "Схемы",
        "table.service": "Сервис",
        "table.version": "Версия",
        "table.role": "Роль",
        "table.depends_on": "Зависит от",
        "table.used_by": "Используется",
        "table.created": "Создан",
        "table.id": "ID",
        "schemas.empty": "Пока нет схем. Создайте через API.",

        // Graph
        "graph.title": "Сервисы",
        "graph.empty": "Нет сервисов для отображения.",
        "graph.loading": "Загрузка графа…",
        "graph.connections": "Связей: {{count}}",
        "graph.library_error": "Не удалось загрузить библиотеку графа. Проверьте подключение к интернету.",

        // Legend (простые названия)
        "legend.api": "API",
        "legend.client": "Клиент",
        "legend.both": "API + Клиент",
        "legend.selected": "Выбранный",
        "legend.none": "Автономный",

        // Details panel
        "details.clients": "Клиенты",
        "details.apis": "API",
        "details.latest": "Последняя версия",
        "details.no_deps": "Нет зависимостей для этого сервиса.",
        "details.check_btn": "Проверить новую версию",
        "details.recent_checks": "Последние проверки",
        "details.dependency": "Зависимость",
        "details.client": "Клиент",
        "details.api": "API",
        "details.constraint": "Ограничение",

        // Contract view
        "contract.provider_defines": "Что отдаёт API",
        "contract.consumer_expects": "Что ожидает Клиент",
        "contract.client_sends": "Что отправляет Клиент",
        "contract.api_expects": "Что ожидает API",
        "contract.api_returns": "Что возвращает API",
        "contract.client_receives": "Что получает Клиент",
        "contract.provider_only": "Только в спецификации API",
        "contract.consumer_only": "Только в спецификации Клиента",
        "contract.type_mismatch": "Несовпадение типов",
        "contract.matched": "сопоставлен",
        "contract.provider_only_badge": "только у провайдера",
        "contract.parameters": "Параметры",
        "contract.request_body": "Тело запроса",
        "contract.responses": "Ответы",

        // Check modal
        "check.title": "Запуск проверки совместимости",
        "check.service_label": "Сервис",
        "check.select_placeholder": "— Выберите сервис —",
        "check.version_label": "Новая версия",
        "check.latest_hint": "Последняя версия",
        "check.cancel": "Отмена",
        "check.submit": "Запустить",
        "check.running": "Выполняется проверка…",
        "check.fetching": "Получение результатов…",

        // Check results
        "check.compatible": "Совместимо",
        "check.breaking": "Ломающее изменение",
        "check.changes_title": "Изменения",
        "check.consumers_title": "Затронутые клиенты",
        "check.pending": "Проверка ещё выполняется…",
        "check.severity_critical": "критично",
        "check.severity_major": "значительно",
        "check.severity_minor": "незначительно",
        "check.version_major": "Рекомендуется мажорная версия — обнаружены ломающие изменения",
        "check.version_minor": "Минорная версия — только добавления",
        "check.version_patch": "Патч-версия — только внутренние изменения",

        // Recent checks
        "checks.title": "Последние проверки",
        "checks.empty": "Проверок пока не было.",

        // General
        "loading": "Загрузка…",
        "active": "активен",
        "change": "изменение",
        "changes": "изменений",
        "consumer": "клиент",
        "consumers": "клиентов",
        "affected": "затронуто",
        "compatible_label": "Совместимо",
        "breaking_label": "Ломающее",
        "pending": "В ожидании",
        "error_prefix": "Ошибка",
        "general.status": "Статус",
    },
};

// ── Helpers ────────────────────────────────

function getLocale() {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || "en";
}

function setLocale(lang) {
    localStorage.setItem(LOCALE_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
}

/**
 * Translate a key. Supports simple interpolation: t("key", {count: 3})
 * If key has plural variants (key.one, key.few, key.many), picks by count.
 */
function t(key, params) {
    const lang = getLocale();
    const dict = translations[lang] || translations.en;
    let val = dict[key];

    // Fallback to English
    if (val === undefined) {
        val = translations.en[key];
    }
    if (val === undefined) return key;

    // Simple interpolation: {{count}}
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            val = val.replace(`{{${k}}}`, v);
        }
    }

    return val;
}

/**
 * Translate with plural support.
 * Pass key without suffix: t.plural("change", 3) → looks for "change.other" or "change.many"
 */
t.plural = function (baseKey, count) {
    const lang = getLocale();
    const dict = translations[lang] || translations.en;

    // Russian plural rules
    if (lang === "ru") {
        const mod10 = count % 10;
        const mod100 = count % 100;
        let form;
        if (mod10 === 1 && mod100 !== 11) form = "one";
        else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) form = "few";
        else form = "many";

        const key = `${baseKey}.${form}`;
        const val = dict[key] || translations.en[key];
        return (val || baseKey).replace("{{count}}", count);
    }

    // English: one / other
    const key = count === 1 ? `${baseKey}.one` : `${baseKey}.other`;
    const val = dict[key] || translations.en[key];
    return (val || baseKey).replace("{{count}}", count);
};

/**
 * Apply i18n to all elements with data-i18n attribute.
 */
function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        let val = t(key);
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            el.placeholder = val;
        } else {
            el.textContent = val;
        }
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.title = t(el.getAttribute("data-i18n-title"));
    });

    // Update language switcher
    const current = getLocale();
    document.querySelectorAll(".lang-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.lang === current);
    });
}

// ── Init ───────────────────────────────────
setLocale(getLocale());
