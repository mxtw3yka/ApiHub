/* ========================================
   API Contract Platform — Dashboard Logic
   ======================================== */

const API_BASE = "/api/v1";

let state = {
    schemas: [],
    dependencies: [],
    checks: [],
};

let _selectedServiceId = null;

async function apiGet(path) {
    const resp = await fetch(API_BASE + path);
    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${resp.status}`);
    }
    return resp.json();
}

async function apiPost(path, body) {
    const resp = await fetch(API_BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${resp.status}`);
    }
    return resp.json();
}

function renderSchemas(schemas) {
}

function updateStats(schemas, deps, checks) {
    const uniqueServices = new Set(schemas.map((s) => s.service_id));
    document.getElementById("stat-services").textContent = uniqueServices.size;
    document.getElementById("stat-deps").textContent = deps.length;

    const completed = checks.filter((c) => c.result);
    const ok = completed.filter((c) => c.result.compatible);
    const bad = completed.filter((c) => !c.result.compatible);
    document.getElementById("stat-ok").textContent = ok.length;
    document.getElementById("stat-breaking").textContent = bad.length;

    const depsSub = document.getElementById("stat-deps-sub");
    if (depsSub) depsSub.textContent = deps.length > 0 ? `${deps.length} total` : "";
    const okSub = document.getElementById("stat-ok-sub");
    if (okSub) okSub.textContent = completed.length > 0 ? `${Math.round((ok.length / completed.length) * 100)}%` : "";
    const badSub = document.getElementById("stat-breaking-sub");
    if (badSub) badSub.textContent = bad.length > 0 ? `${bad.length} found` : "";
}

function updateDepsCount(deps) {
    document.getElementById("deps-count").textContent = deps.length;
}

function renderDeps(deps) {
    const container = document.getElementById("deps-list");
    if (!container) return;
    if (deps.length === 0) {
        container.innerHTML = `<div class="empty-state">${t("deps.empty") || "No dependencies found."}</div>`;
        return;
    }
    const nameMap = {};
    state.schemas.forEach((s) => { nameMap[s.service_id] = s.service_name; });
    container.innerHTML = deps.slice(0, 20).map((d) => {
        const cName = nameMap[d.consumer_service_id] || shortId(d.consumer_service_id);
        const pName = nameMap[d.provider_service_id] || shortId(d.provider_service_id);
        const status = d.status === "active" ? "ok" : "warn";
        const abbrev = (cName.charAt(0) + pName.charAt(0)).toUpperCase();
        const abbrClass = d.status === "active" ? "green" : "orange";
        return `<div class="dep-item ${status}" onclick="showEdgeDetails('${d.id}')">
            <div class="dep-left">
                <div class="dep-abbr ${abbrClass}">${escHtml(abbrev)}</div>
                <span class="dep-name">${escHtml(cName)}</span>
                <span class="dep-arrow">→</span>
                <span class="dep-name">${escHtml(pName)}</span>
            </div>
            <div class="dep-right">
                <span class="dep-constraint">${escHtml(d.provider_constraint)}</span>
                <span class="dep-status ${status}">${escHtml(d.status)}</span>
            </div>
        </div>`;
    }).join("");
}

function populateSidebar() {
    const container = document.getElementById("sidebar-services");
    if (!container) return;
    const seen = {};
    state.schemas.forEach((s) => {
        const prev = seen[s.service_id];
        if (!prev || s.version > prev.version) seen[s.service_id] = s;
    });
    const list = Object.values(seen);
    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state" style="font-size:12px;padding:8px">No services</div>`;
        return;
    }
    container.innerHTML = list.map((s) => {
        const role = getServiceRole(s.service_id, state.dependencies);
        return `<div class="service-item" onclick="focusService('${s.service_id}')">
            <span class="svc-dot ${role}"></span>
            <span class="service-item-name">${escHtml(s.service_name)}</span>
        </div>`;
    }).join("");
}

function updatePageMeta(schemas, deps) {
    const meta = document.getElementById("page-meta");
    if (!meta) return;
    const unique = new Set(schemas.map((s) => s.service_id));
    meta.textContent = `${unique.size} services · ${deps.length} dependencies`;
}

function getServiceRole(serviceId, deps) {
    let isConsumer = false, isProvider = false;
    for (const d of deps) {
        if (d.consumer_service_id === serviceId) isConsumer = true;
        if (d.provider_service_id === serviceId) isProvider = true;
    }
    if (isConsumer && isProvider) return "both";
    if (isProvider) return "provider";
    if (isConsumer) return "consumer";
    return "none";
}

function focusService(serviceId) {
    clearHighlight();
    _selectedServiceId = serviceId;
    const row = document.querySelector(`[data-sid="${serviceId}"]`);
    if (row) row.classList.add("st-selected");
    showServiceDetails(serviceId);
}

function clearHighlight() {
    _selectedServiceId = null;
    document.querySelectorAll(".st-selected").forEach(el => el.classList.remove("st-selected"));
}

function renderServiceTable(schemas, deps) {
    const container = document.getElementById("graph-container");
    if (!container) return;

    const svcMap = {};
    schemas.forEach(s => {
        const existing = svcMap[s.service_id];
        if (!existing || s.version > existing.version) svcMap[s.service_id] = s;
    });
    const services = Object.values(svcMap);
    if (services.length === 0) {
        container.innerHTML = `<div class="empty-state">${t("graph.empty")}</div>`;
        return;
    }

    const nameMap = {};
    schemas.forEach(s => { nameMap[s.service_id] = s.service_name; });

    const svcInfo = services.map(s => ({
        id: s.service_id, name: s.service_name, version: s.version,
        role: getServiceRole(s.service_id, deps),
        consumes: deps.filter(d => d.consumer_service_id === s.service_id),
        providers: deps.filter(d => d.provider_service_id === s.service_id),
    }));

    const order = { consumer: 0, both: 1, provider: 2 };
    svcInfo.sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));

    let html = `<div class="st-wrap">
      <div class="st-header">
        <span class="st-col-svc">${t("table.service")}</span>
        <span class="st-col-role st-hide-sm">${t("table.role")}</span>
        <span class="st-col-deps">${t("table.depends_on")}</span>
        <span class="st-col-used st-hide-sm">${t("table.used_by")}</span>
        <span class="st-col-ver">${t("table.version")}</span>
      </div>`;

    svcInfo.forEach(info => {
        const rl = { consumer: t("legend.client"), provider: t("legend.api"), both: `${t("legend.api")} + ${t("legend.client")}`, none: t("legend.none") || "—" }[info.role] || info.role;
        const badgeClass = info.role === 'consumer' ? 'badge-info' : info.role === 'both' ? 'badge-warning' : info.role === 'none' ? 'badge-neutral' : 'badge-success';
        const consumesHtml = info.consumes.length
            ? info.consumes.map(c => `${escHtml(nameMap[c.provider_service_id] || shortId(c.provider_service_id))} <code class="st-constraint">${escHtml(c.provider_constraint)}</code>`).join(', ')
            : '<span class="st-muted">—</span>';
        const providesHtml = info.providers.length
            ? info.providers.map(p => escHtml(nameMap[p.consumer_service_id] || shortId(p.consumer_service_id))).join(', ')
            : '<span class="st-muted">—</span>';

        html += `<div class="st-row" data-sid="${info.id}" onclick="focusService('${info.id}')">
          <span class="st-col-svc"><span class="svc-dot ${info.role}"></span> ${escHtml(info.name)}</span>
          <span class="st-col-role st-hide-sm"><span class="badge ${badgeClass}">${escHtml(rl)}</span></span>
          <span class="st-col-deps">${consumesHtml}</span>
          <span class="st-col-used st-hide-sm">${providesHtml}</span>
          <span class="st-col-ver"><code>v${info.version}</code></span>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    renderLegend();
}


function showServiceDetails(serviceId) {
    const panel = document.getElementById("details-panel");
    const info = document.getElementById("details-info");

    const schemasForService = state.schemas.filter((s) => s.service_id === serviceId);
    const name = schemasForService.length > 0 ? schemasForService[0].service_name : shortId(serviceId);
    const latestVersion = schemasForService.reduce((best, s) => (s.version > best ? s.version : best), "");

    const asConsumer = state.dependencies.filter((d) => d.consumer_service_id === serviceId);
    const asProvider = state.dependencies.filter((d) => d.provider_service_id === serviceId);

    const nameMap = {};
    state.schemas.forEach((s) => {
        nameMap[s.service_id] = s.service_name;
    });

    const role = getServiceRole(serviceId, state.dependencies);
    const roleMap = {
        provider: t("legend.api"),
        consumer: t("legend.client"),
        both: `${t("legend.api")} + ${t("legend.client")}`,
        none: t("legend.none"),
    };
    const roleLabel = roleMap[role] || role;

    let html = `
    <div class="details-header">
      <strong>${escHtml(name)}</strong>
      <span class="badge badge-info">${escHtml(roleLabel)}</span>
      <span class="details-id">${serviceId}</span>
    </div>
    <div class="details-meta">${t("details.latest")}: <code>${latestVersion || "—"}</code></div>
    <button class="btn btn-primary btn-sm" onclick="runCheck('${serviceId}')" style="margin-bottom:12px">🔍 ${t("details.check_btn")}</button>`;

    const latestSchema = schemasForService.reduce((best, s) => (s.version > best.version ? s : best), schemasForService[0]);
    const endpoints = latestSchema?.spec ? parseOpenApiEndpoints(latestSchema.spec) : [];
    if (endpoints.length > 0) {
        html += `<div class="details-section">
          <h4>📡 Endpoints (${endpoints.length})</h4>`;
        endpoints.forEach((ep) => {
            const summary = ep.summary ? ` — ${escHtml(ep.summary)}` : '';
            const reqSchema = ep.requestBody ? getSchemaName(ep.requestBody.content, latestSchema.spec) || 'body' : '';
            const resCodes = Object.keys(ep.responses).join(', ');
            html += `<div class="endpoint-row">
              <span class="method-badge method-${ep.method.toLowerCase()}">${ep.method}</span>
              <code class="ep-path">${escHtml(ep.path)}</code>
              <span class="ep-summary">${summary}</span>
              <span class="ep-schemas">
                ${reqSchema ? `<span class="ep-schema-tag">→ ${escHtml(reqSchema)}</span>` : ''}
                ${resCodes ? `<span class="ep-status-codes">${escHtml(resCodes)}</span>` : ''}
              </span>
            </div>`;
        });
        html += `</div>`;
    }

    if (asProvider.length > 0) {
        html += `<div class="details-section">
          <h4>⬇ ${t("details.clients")} (${asProvider.length})</h4>`;
        asProvider.forEach((d) => {
            const cName = nameMap[d.consumer_service_id] || shortId(d.consumer_service_id);
            const statusLabel = d.status === "active" ? t("active") : d.status;
            const usedEndpoints = d.endpoints && d.endpoints.length > 0
                ? `<details class="used-endpoints-details">
                    <summary class="used-endpoints-summary">${d.endpoints.length} endpoint${d.endpoints.length > 1 ? 's' : ''}</summary>
                    <div class="used-endpoints">${d.endpoints.map(e => `<code>${escHtml(e)}</code>`).join('')}</div>
                  </details>`
                : '';
            html += `<div class="details-row deps-row">
              <div class="deps-info">
                <span class="dep-service-name">${escHtml(cName)}</span>
                <span class="dep-constraint">${t("details.constraint")}: ${escHtml(d.provider_constraint)}</span>
                ${usedEndpoints}
              </div>
              <span class="badge ${d.status === "active" ? "badge-success" : "badge-warning"}">${escHtml(statusLabel)}</span>
            </div>`;
        });
        html += `</div>`;
    }

    if (asConsumer.length > 0) {
        html += `<div class="details-section">
          <h4>⬆ ${t("details.apis")} (${asConsumer.length})</h4>`;
        asConsumer.forEach((d) => {
            const pName = nameMap[d.provider_service_id] || shortId(d.provider_service_id);
            const statusLabel = d.status === "active" ? t("active") : d.status;
            const usedEndpoints = d.endpoints && d.endpoints.length > 0
                ? `<details class="used-endpoints-details">
                    <summary class="used-endpoints-summary">${d.endpoints.length} endpoint${d.endpoints.length > 1 ? 's' : ''}</summary>
                    <div class="used-endpoints">${d.endpoints.map(e => `<code>${escHtml(e)}</code>`).join('')}</div>
                  </details>`
                : '';
            html += `<div class="details-row deps-row">
              <div class="deps-info">
                <span class="dep-service-name">${escHtml(pName)}</span>
                <span class="dep-constraint">${t("details.constraint")}: ${escHtml(d.provider_constraint)}</span>
                ${usedEndpoints}
              </div>
              <span class="badge ${d.status === "active" ? "badge-success" : "badge-warning"}">${escHtml(statusLabel)}</span>
            </div>`;
        });
        html += `</div>`;
    }

    if (asConsumer.length === 0 && asProvider.length === 0) {
        html += `<div class="empty-state" style="padding:16px">${t("details.no_deps")}</div>`;
    }

    const relevantChecks = state.checks.filter(
        (c) => c.result && c.result.affected_consumers.some((ac) => ac.id === serviceId)
    );
    if (relevantChecks.length > 0) {
        html += `<div class="details-section">
          <h4>🔍 ${t("details.recent_checks")}</h4>`;
        relevantChecks.slice(0, 3).forEach((c) => {
            html += `<div class="details-row">
              <span>${c.result.compatible ? "✅ " + t("compatible_label") : "❌ " + t("breaking_label")}</span>
              <span class="check-meta">${formatTime(c.created_at)}</span>
            </div>`;
        });
        html += `</div>`;
    }

    info.innerHTML = html;
    panel.classList.add("visible");
}

function showEdgeDetails(edgeId) {
    const dep = state.dependencies.find((d) => d.id === edgeId);
    if (!dep) return;

    const nameMap = {};
    state.schemas.forEach((s) => {
        nameMap[s.service_id] = s.service_name;
    });

    const panel = document.getElementById("details-panel");
    const info = document.getElementById("details-info");

    const consumerName = nameMap[dep.consumer_service_id] || shortId(dep.consumer_service_id);
    const providerName = nameMap[dep.provider_service_id] || shortId(dep.provider_service_id);

    const providerSchemas = state.schemas.filter((s) => s.service_id === dep.provider_service_id);
    const latestProviderSchema = providerSchemas.reduce((best, s) => (s.version > best.version ? s : best), providerSchemas[0]);
    const providerEndpoints = latestProviderSchema?.spec ? parseOpenApiEndpoints(latestProviderSchema.spec) : [];

    const consumerSchemas = state.schemas.filter((s) => s.service_id === dep.consumer_service_id);
    const latestConsumerSchema = consumerSchemas.reduce((best, s) => (s.version > best.version ? s : best), consumerSchemas[0]);
    const consumerEndpoints = latestConsumerSchema?.spec ? parseOpenApiEndpoints(latestConsumerSchema.spec) : [];

    const usedEndpoints = dep.endpoints || [];

    let html = `
    <div class="details-header">
      <strong>${t("details.dependency")}</strong>
      <span class="badge ${dep.status === "active" ? "badge-success" : "badge-warning"}">${escHtml(dep.status === "active" ? t("active") : dep.status)}</span>
    </div>
    <div class="details-section">
      <div class="details-row">
        <span>${t("details.client")}:</span>
        <strong>${escHtml(consumerName)}</strong>
      </div>
      <div class="details-row">
        <span>${t("details.api")}:</span>
        <strong>${escHtml(providerName)}</strong>
      </div>
      <div class="details-row">
        <span>${t("details.constraint")}:</span>
        <code>${escHtml(dep.provider_constraint)}</code>
      </div>
    </div>`;

    const endpointsToShow = [];
    if (usedEndpoints.length > 0) {
        usedEndpoints.forEach((uep) => {
            const parts = uep.split(' ');
            const method = parts[0];
            const path = parts.slice(1).join(' ');
            const providerEp = providerEndpoints.find((pe) => pe.method === method && pe.path === path);
            const consumerEp = consumerEndpoints.find((ce) => ce.method === method && ce.path === path);
            if (providerEp) {
                endpointsToShow.push({ endpoint: providerEp, consumerEndpoint: consumerEp });
            } else {
                endpointsToShow.push({ endpoint: { method, path, summary: uep }, consumerEndpoint: consumerEp });
            }
        });
    } else {
        providerEndpoints.forEach((ep) => {
            const consumerEp = consumerEndpoints.find((ce) => ce.method === ep.method && ce.path === ep.path);
            endpointsToShow.push({ endpoint: ep, consumerEndpoint: consumerEp });
        });
    }

    html += `<div class="details-section contract-section-wrapper">
      <h4>📋 Contract: «${escHtml(consumerName)}» ↔ «${escHtml(providerName)}»</h4>`;
    endpointsToShow.forEach(({ endpoint, consumerEndpoint }) => {
        html += renderContractComparison(endpoint, consumerEndpoint, latestProviderSchema.spec, latestConsumerSchema?.spec, usedEndpoints);
    });
    html += `</div>`;

    html += `<div class="details-section" style="margin-top:8px">
      <div class="details-row">
        <span>ID:</span>
        <code>${dep.id}</code>
      </div>
    </div>`;

    info.innerHTML = html;
    panel.classList.add("visible");
}

function hideDetails() {
    const panel = document.getElementById("details-panel");
    panel.classList.remove("visible");
}

function renderLegend() {
    const el = document.getElementById("graph-legend");
    if (!el) return;
    el.innerHTML = `
    <div class="legend-item"><span class="legend-dot" style="background:#eef2ff;border:1.5px solid #818cf8"></span> ${t("legend.api")}</div>
    <div class="legend-item"><span class="legend-dot" style="background:#ecfdf5;border:1.5px solid #34d399"></span> ${t("legend.client")}</div>
    <div class="legend-item"><span class="legend-dot" style="background:#fff7ed;border:1.5px solid #fb923c"></span> ${t("legend.api")} + ${t("legend.client")}</div>
    <div class="legend-item"><span class="legend-dot" style="background:#fcfbf9;border:1.5px solid #6366f1"></span> ${t("legend.selected")}</div>
    <div class="legend-item"><span class="legend-dot" style="background:#f5f5f4;border:1.5px solid #d6d3d1"></span> ${t("legend.none")}</div>
    `;
}

function renderChecks(checks) {
    const container = document.getElementById("checks-body");
    const countEl = document.getElementById("checks-count");

    countEl.textContent = checks.length;

    if (checks.length === 0) {
        container.innerHTML = `<div class="empty-state">${t("checks.empty")}</div>`;
        return;
    }

    container.innerHTML = checks
        .map(
            (c, idx) => `
        <div class="check-card" data-idx="${idx}" onclick="openCheckDetail(${idx})">
          <div>
            <div>
              ${
                  c.result
                      ? `<span class="badge ${c.result.compatible ? "badge-success" : "badge-danger"}">${c.result.compatible ? t("compatible_label") : t("breaking_label")}</span>`
                      : `<span class="badge badge-warning">${t("pending")}</span>`
              }
              <span class="check-service-name">${c._serviceName ? escHtml(c._serviceName) : "Check " + shortId(c.id)}</span>
            </div>
            <div class="check-meta" style="margin-top:4px">
              ${c.result ? `${c.result.changes.length} ${t("changes")}, ${c.result.affected_consumers.length} ${t("consumers")} ${t("affected")}` : ""}
            </div>
          </div>
          <div class="check-meta">${formatTime(c.created_at)}</div>
          <div class="check-click-hint">👁</div>
        </div>`
        )
        .join("");
}

function openCheckDetail(idx) {
    const check = state.checks[idx];
    if (!check) return;
    const modal = document.getElementById("check-modal");
    document.getElementById("check-form").style.display = "none";
    document.getElementById("check-hint").style.display = "none";
    modal.classList.add("visible");
    showCheckDetail(check, check._serviceName || "—");
}

function hideCheckModal() {
    const modal = document.getElementById("check-modal");
    modal.classList.remove("visible");
    document.getElementById("check-form").style.display = "";
    document.getElementById("check-hint").style.display = "";
    document.getElementById("check-detail").style.display = "none";
    document.getElementById("check-result").className = "check-result";
    document.getElementById("check-result").textContent = "";
}


const _cache = { ttl: 10000 };

function _cached(key, fetcher) {
    const now = Date.now();
    if (_cache[key] && now - _cache[key].ts < _cache.ttl) {
        return _cache[key].data;
    }
    const promise = fetcher().then((data) => {
        _cache[key] = { data, ts: Date.now() };
        return data;
    });
    _cache[key] = { data: promise, ts: now };
    return promise;
}

async function loadAll() {
    showError(null);

    try {
        const [schemasData, depsData, checksData] = await Promise.all([
            _cached("schemas", () => apiGet("/schemas/")),
            _cached("dependencies", () => apiGet("/dependencies/")),
            _cached("checks", () => apiGet("/check").catch(() => ({ items: [] }))),
        ]);

        state.schemas = schemasData.items || [];
        state.dependencies = Array.isArray(depsData) ? depsData : [];
        state.checks = Array.isArray(checksData) ? checksData : (checksData.items || []);

        renderSchemas(state.schemas);
        updateDepsCount(state.dependencies);
        updateStats(state.schemas, state.dependencies, state.checks);
        renderDeps(state.dependencies);
        renderChecks(state.checks);
        populateSidebar();
        updatePageMeta(state.schemas, state.dependencies);

        renderServiceTable(state.schemas, state.dependencies);
    } catch (err) {
        showError(err.message);
    }
}



/**
 * Opens the Run Check modal, optionally pre-selecting a service.
 * If a serviceId is passed, that service is auto-selected.
 */
async function runCheck(serviceId) {
    const modal = document.getElementById("check-modal");
    const form = document.getElementById("check-form");
    const resultEl = document.getElementById("check-result");
    const detailEl = document.getElementById("check-detail");
    const serviceSelect = document.getElementById("check-service");
    const versionInput = document.getElementById("check-version");
    const hintEl = document.getElementById("check-hint");
    const latestSpan = document.getElementById("check-latest-version");

    resultEl.className = "check-result";
    resultEl.textContent = "";
    detailEl.style.display = "none";
    _activeCheckServiceId = null;

    const unique = {};
    state.schemas.forEach((s) => {
        const prev = unique[s.service_id];
        if (!prev || s.version > prev.version) {
            unique[s.service_id] = { name: s.service_name, version: s.version };
        }
    });

    serviceSelect.innerHTML = `<option value="">${t("check.select_placeholder")}</option>`;
    Object.entries(unique).forEach(([id, info]) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = `${info.name} (latest: v${info.version})`;
        serviceSelect.appendChild(opt);
    });

    if (serviceId && unique[serviceId]) {
        serviceSelect.value = serviceId;
        versionInput.value = suggestNextVersion(unique[serviceId].version);
        latestSpan.textContent = unique[serviceId].version;
        hintEl.style.display = "block";
        _activeCheckServiceId = serviceId;
    } else {
        versionInput.value = "";
        latestSpan.textContent = "—";
        hintEl.style.display = "none";
    }

    function onServiceChange() {
        const val = serviceSelect.value;
        if (val && unique[val]) {
            latestSpan.textContent = unique[val].version;
            hintEl.style.display = "block";
            if (!versionInput.value) {
                versionInput.value = suggestNextVersion(unique[val].version);
            }
        } else {
            hintEl.style.display = "none";
            latestSpan.textContent = "—";
        }
    }
    serviceSelect.addEventListener("change", onServiceChange);

    modal.classList.add("visible");
    versionInput.focus();

    return new Promise((resolve) => {
        function close() {
            hideCheckModal();
            form.removeEventListener("submit", onSubmit);
            serviceSelect.removeEventListener("change", onServiceChange);
            document.getElementById("btn-cancel-check").removeEventListener("click", close);
        }

        async function onSubmit(e) {
            e.preventDefault();
            const selectedServiceId = serviceSelect.value;
            const version = versionInput.value.trim();
            if (!selectedServiceId || !version) return;

            resultEl.className = "check-result visible";
            resultEl.textContent = "⏳ " + t("check.running");
            detailEl.style.display = "none";

            try {
                const resp = await apiPost("/check", {
                    service_id: selectedServiceId,
                    version: version,
                });

                resultEl.className = "check-result visible";
                resultEl.textContent = "⏳ " + t("check.fetching");

                const checkResult = await apiGet(`/check/${resp.check_id}`);
                checkResult._serviceName = (unique[selectedServiceId] || {}).name || selectedServiceId;
                state.checks.unshift(checkResult);
                renderChecks(state.checks);
                updateStats(state.schemas, state.dependencies, state.checks);

                showCheckDetail(checkResult, unique[selectedServiceId]?.name || selectedServiceId);
                resultEl.style.display = "none";
            } catch (err) {
                resultEl.className = "check-result visible error";
                resultEl.textContent = "❌ " + err.message;
                detailEl.style.display = "none";
            }
        }

        form.addEventListener("submit", onSubmit);
        document.getElementById("btn-cancel-check").addEventListener("click", close);
    });
}

function showCheckDetail(check, serviceName) {
    const detailEl = document.getElementById("check-detail");
    const summaryEl = document.getElementById("detail-summary");
    const changesEl = document.getElementById("detail-changes");
    const consumersEl = document.getElementById("detail-consumers");

    if (!check.result) {
        detailEl.style.display = "block";
        summaryEl.className = "detail-summary";
        summaryEl.textContent = "⏳ " + t("check.pending");
        changesEl.innerHTML = "";
        consumersEl.innerHTML = "";
        return;
    }

    const r = check.result;
    const isCompatible = r.compatible;

    summaryEl.className = `detail-summary ${isCompatible ? "compatible" : "breaking"}`;
    summaryEl.innerHTML = `
        <div class="summary-icon">${isCompatible ? "✅" : "❌"}</div>
        <div class="summary-text">
            <strong>${isCompatible ? t("check.compatible") : t("check.breaking")}</strong>
            <span class="summary-meta">
                ${escHtml(serviceName)} · ${r.changes.length} ${t("changes")} · ${r.affected_consumers.length} ${t("consumers")} ${t("affected")}
            </span>
        </div>
    `;

    const hasBreaking = r.changes.some(c => c.severity === "critical");
    const hasAdditions = r.changes.some(c => c.category === "field_added" || c.category === "endpoint_added");
    const hasOnlyInternal = !hasBreaking && !hasAdditions && r.changes.length > 0;
    let versionSuggestion = '';
    if (hasBreaking) {
        versionSuggestion = `<div class="version-suggestion version-major">🚨 ${t("check.version_major")}</div>`;
    } else if (hasAdditions) {
        versionSuggestion = `<div class="version-suggestion version-minor">📈 ${t("check.version_minor")}</div>`;
    } else if (hasOnlyInternal) {
        versionSuggestion = `<div class="version-suggestion version-patch">🔧 ${t("check.version_patch")}</div>`;
    }

    if (r.changes.length > 0) {
        let changesHtml = `<div class="detail-section-title">📋 ${t("check.changes_title")}</div>`;

        if (versionSuggestion) {
            changesHtml += versionSuggestion;
        }

        const groups = groupChangesByOperation(r.changes);

        groups.forEach((group) => {
            const isEndpoint = group.method && group.endpointPath;
            const groupId = "op-group-" + escHtml(group.label).replace(/\s+/g, "-");

            if (isEndpoint) {
                changesHtml += `
                <div class="op-group">
                    <div class="op-header" onclick="toggleOpGroup(this.parentElement)">
                        <div class="op-header-left">
                            <span class="method-badge method-${group.method.toLowerCase()}">${escHtml(group.method)}</span>
                            <code class="op-path">${escHtml(group.endpointPath)}</code>
                        </div>
                        <div class="op-header-right">
                            <span class="op-change-count">
                                ${group.criticalCount} crit · ${group.majorCount} maj · ${group.minorCount} min
                            </span>
                            <span class="op-toggle">▶</span>
                        </div>
                    </div>
                    <div class="op-body">`;
            } else {
                changesHtml += `
                <div class="op-group">
                    <div class="op-header" onclick="toggleOpGroup(this.parentElement)">
                        <div class="op-header-left">
                            <span class="op-schema-icon">📦</span>
                            <code class="op-path">${escHtml(group.label)}</code>
                        </div>
                        <div class="op-header-right">
                            <span class="op-change-count">
                                ${group.criticalCount} crit · ${group.majorCount} maj · ${group.minorCount} min
                            </span>
                            <span class="op-toggle">▶</span>
                        </div>
                    </div>
                    <div class="op-body">`;
            }

            const sevOrder = { critical: 0, major: 1, minor: 2 };
            const sorted = [...group.changes].sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9));
            sorted.forEach((c) => {
                const sevIcon = c.severity === "critical" ? "🚫" : c.severity === "major" ? "⚠️" : "ℹ️";
                const sevKey = c.severity === "critical"
                    ? "check.severity_critical"
                    : c.severity === "major"
                        ? "check.severity_major"
                        : "check.severity_minor";
                const severityBadge =
                    c.severity === "critical"
                        ? `<span class="badge badge-danger">${sevIcon} ${t(sevKey)}</span>`
                        : c.severity === "major"
                            ? `<span class="badge badge-warning">${sevIcon} ${t(sevKey)}</span>`
                            : `<span class="badge badge-info">${sevIcon} ${t(sevKey)}</span>`;

                const categoryLabel = c.category.replace(/_/g, " ");

                const location = describeChangeLocation(c.path);

                changesHtml += `
                <div class="change-item severity-${c.severity}">
                    <div class="change-header" onclick="toggleChange(this.parentElement)">
                        <div class="change-header-left">
                            ${severityBadge}
                            <span class="change-category">${escHtml(categoryLabel)}</span>
                        </div>
                        <div class="change-header-right">
                            ${location ? `<span class="change-location">${escHtml(location)}</span>` : ""}
                            <code class="change-path" title="${escHtml(c.path)}">${escHtml(humanizePath(c.path))}</code>
                            <span class="change-toggle">▶</span>
                        </div>
                    </div>
                    <div class="change-body">
                        <div class="change-desc">${escHtml(c.description)}</div>
                        <div class="change-diff">
                            <div class="diff-box diff-old">
                                <div class="diff-label">← Old</div>
                                <code>${escHtml(c.old_value) || "—"}</code>
                            </div>
                            <div class="diff-arrow">→</div>
                            <div class="diff-box diff-new">
                                <div class="diff-label">New →</div>
                                <code>${escHtml(c.new_value) || "—"}</code>
                            </div>
                        </div>
                        ${c.recommendation ? `<div class="change-rec">💡 ${escHtml(c.recommendation)}</div>` : ""}
                        ${r.affected_consumers.length > 0 ? `
                        <div class="change-consumers">
                            <div class="change-consumers-label">${t("check.consumers_title")}:</div>
                            ${r.affected_consumers.map(ac => `<span class="consumer-chip">⚠ ${escHtml(ac.name)}</span>`).join("")}
                        </div>` : ""}
                    </div>
                </div>`;
            });

            changesHtml += `</div></div>`;
        });

        changesEl.innerHTML = changesHtml;
    } else {
        changesEl.innerHTML = "";
    }

    if (r.affected_consumers.length > 0) {
        let consHtml = `<div class="detail-section-title">${t("check.consumers_title")}</div>
        <div class="consumers-summary">`;
        r.affected_consumers.forEach((c) => {
            consHtml += `<span class="consumer-chip consumer-chip-lg">⚠ ${escHtml(c.name)}</span>`;
        });
        consHtml += "</div>";
        consumersEl.innerHTML = consHtml;
    } else {
        consumersEl.innerHTML = "";
    }

    detailEl.style.display = "block";
}

function toggleChange(el) {
    el.classList.toggle("expanded");
}

function toggleOpGroup(el) {
    el.classList.toggle("expanded");
}

/**
 * Parse a DeepDiff path into structured operation info.
 * E.g. root['paths']['/pets']['get']['responses']['200']...
 *   → { endpointPath: '/pets', method: 'GET' }
 * E.g. root['components']['schemas']['Pet']...
 *   → { schemaName: 'Pet', method: null, endpointPath: null }
 */
function parseOperationFromPath(path) {
    const endpointMatch = path.match(/^root\s*\[\s*['"]paths['"]\s*\]\s*\[\s*['"]([^'"]+)['"]\s*\]\s*\[\s*['"]([^'"]+)['"]\s*\]/);
    if (endpointMatch) {
        return { endpointPath: endpointMatch[1], method: endpointMatch[2].toUpperCase(), schemaName: null };
    }
    const pathOnlyMatch = path.match(/^root\s*\[\s*['"]paths['"]\s*\]\s*\[\s*['"]([^'"]+)['"]\s*\]$/);
    if (pathOnlyMatch) {
        return { endpointPath: pathOnlyMatch[1], method: null, schemaName: null };
    }
    const schemaMatch = path.match(/^root\s*\[\s*['"]components['"]\s*\]\s*\[\s*['"]schemas['"]\s*\]\s*\[\s*['"]([^'"]+)['"]\s*\]/);
    if (schemaMatch) {
        return { endpointPath: null, method: null, schemaName: schemaMatch[1] };
    }
    return null;
}

/**
 * Determine a human-readable location within an operation from the path.
 * E.g. 'responses' → "Response 200", 'requestBody' → "Request Body", 'parameters' → "Parameter"
 */
function describeChangeLocation(path) {
    const respMatch = path.match(/\[['"]responses['"]\]\s*\[\s*['"](\d+)['"]\s*\]/);
    if (respMatch) return `Response ${respMatch[1]}`;
    if (/\[['"]requestBody['"]\]/.test(path)) return "Request Body";
    if (/\[['"]parameters['"]\]/.test(path)) return "Parameter";
    if (/\[['"]security['"]\]/.test(path)) return "Security";
    return null;
}

/**
 * Group changes by operation (endpoint or shared schema).
 * Returns sorted array of groups, each with method, endpointPath, changes, and severity counts.
 */
function groupChangesByOperation(changes) {
    const groupMap = {};

    changes.forEach((c) => {
        const info = parseOperationFromPath(c.path);
        let key, group;

        if (info && info.endpointPath) {
            if (info.method) {
                key = `${info.method} ${info.endpointPath}`;
                group = { label: key, method: info.method, endpointPath: info.endpointPath, schemaName: null, changes: [] };
            } else {
                key = `${info.endpointPath} (all methods)`;
                group = { label: key, method: null, endpointPath: info.endpointPath, schemaName: null, changes: [] };
            }
        } else if (info && info.schemaName) {
            key = `schema:${info.schemaName}`;
            group = { label: `Schema: ${info.schemaName}`, method: null, endpointPath: null, schemaName: info.schemaName, changes: [] };
        } else {
            key = "_other";
            group = { label: "Other", method: null, endpointPath: null, schemaName: null, changes: [] };
        }

        if (!groupMap[key]) {
            groupMap[key] = group;
        }
        groupMap[key].changes.push(c);
    });

    const result = Object.values(groupMap);
    result.forEach((g) => {
        g.criticalCount = g.changes.filter((c) => c.severity === "critical").length;
        g.majorCount = g.changes.filter((c) => c.severity === "major").length;
        g.minorCount = g.changes.filter((c) => c.severity === "minor").length;
    });

    const methodOrder = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    return result.sort((a, b) => {
        const aIsEndpoint = a.method && a.endpointPath;
        const bIsEndpoint = b.method && b.endpointPath;
        const aIsSchema = a.schemaName;
        const bIsSchema = b.schemaName;

        if (aIsEndpoint && !bIsEndpoint) return -1;
        if (!aIsEndpoint && bIsEndpoint) return 1;
        if (aIsSchema && !bIsSchema) return -1;
        if (!aIsSchema && bIsSchema) return 1;

        if (aIsEndpoint && bIsEndpoint) {
            const aIdx = a.method ? methodOrder.indexOf(a.method) : -1;
            const bIdx = b.method ? methodOrder.indexOf(b.method) : -1;
            if (aIdx !== bIdx) return aIdx - bIdx;
            return (a.endpointPath || "").localeCompare(b.endpointPath || "");
        }

        if (a.schemaName && b.schemaName) {
            return a.schemaName.localeCompare(b.schemaName);
        }

        return 0;
    });
}

function suggestNextVersion(current) {
    const parts = current.split(".").map(Number);
    if (parts.length >= 2 && !isNaN(parts[0])) {
        return `${parts[0] + 1}.0.0`;
    }
    return "2.0.0";
}

function escHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function shortId(uuid) {
    return uuid ? uuid.substring(0, 8) + "…" : "";
}

function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString();
}

/**
 * Convert a DeepDiff path like:
 *   root['paths']['/pets']['get']['responses']['200']['content']...['properties']['name']
 * into a human-readable form like:
 *   GET /pets → Response 200 → name
 *
 * Components/schemas paths like:
 *   root['components']['schemas']['Pet']['properties']['name']['description']
 * → Schema Pet → name.description
 */
function humanizePath(path) {
    const tokens = path.match(/\[['"]([^'"]+)['"]\]/g);
    if (!tokens) return path;

    const parts = tokens.map(t => t.replace(/^\[['"]|['"]\]$/g, ''));

    if (parts[0] === 'root') parts.shift();

    if (parts[0] === 'paths') {
        if (parts[1] && parts[2]) {
            const epPath = parts[1];
            const method = parts[2].toUpperCase();
            let rest = parts.slice(3);
            let result = `${method} ${epPath}`;

            for (let i = 0; i < rest.length; i++) {
                const tok = rest[i];
                if (tok === 'responses' && rest[i + 1] && /^\d{3}$/.test(rest[i + 1])) {
                    result += ` → Response ${rest[i + 1]}`;
                    i++;
                } else if (tok === 'requestBody') {
                    result += ` → Request Body`;
                } else if (tok === 'parameters') {
                    result += ` → Parameter`;
                    if (rest[i + 1] && /^\d+$/.test(rest[i + 1])) i++;
                } else if (['type', 'format', 'nullable', 'description', 'maxLength', 'minLength', 'minimum', 'maximum', 'enum', 'default', 'example', 'required'].includes(tok)) {
                    result += ` → ${tok}`;
                } else {
                    result += ` → ${tok}`;
                }
            }
            return result;
        } else if (parts[1]) {
            return `${parts[1]} (all methods)`;
        }
    }

    if (parts[0] === 'components' && parts[1] === 'schemas' && parts[2]) {
        let result = `Schema ${parts[2]}`;
        let rest = parts.slice(3);
        for (let i = 0; i < rest.length; i++) {
            const tok = rest[i];
            if (tok === 'properties') continue;
            result += ` → ${tok}`;
        }
        return result;
    }

    return path;
}

/**
 * Render OpenAPI schema fields recursively with types.
 * Returns HTML string with collapsible sections for nested objects.
 */
function renderSchemaFields(schemaObj, spec, depth) {
    if (depth > 8) return '<span class="sc-depth-limit">…</span>';
    depth = depth || 0;

    if (schemaObj.$ref) {
        const resolved = resolveRef(schemaObj.$ref, spec);
        if (!resolved || resolved === schemaObj.$ref) {
            const name = schemaObj.$ref.split('/').pop();
            return `<span class="sc-ref">«${escHtml(name)}»</span>`;
        }
        return renderSchemaFields(resolved, spec, depth + 1);
    }

    if (schemaObj.allOf) {
        const merged = { type: 'object', properties: {}, required: [] };
        schemaObj.allOf.forEach((sub) => {
            const resolved = sub.$ref ? resolveRef(sub.$ref, spec) || sub : sub;
            if (resolved.properties) Object.assign(merged.properties, resolved.properties);
            if (resolved.required) merged.required = merged.required.concat(resolved.required);
        });
        return renderSchemaFields(merged, spec, depth + 1);
    }

    if (schemaObj.oneOf || schemaObj.anyOf) {
        const items = schemaObj.oneOf || schemaObj.anyOf;
        const label = schemaObj.oneOf ? 'oneOf' : 'anyOf';
        let html = `<div class="sc-combinator">${label}:</div>`;
        items.forEach((item, i) => {
            html += `<div class="sc-combinator-option">${renderSchemaFields(item, spec, depth + 1)}</div>`;
        });
        return html;
    }

    if (schemaObj.type === 'array' && schemaObj.items) {
        const itemHtml = renderSchemaFields(schemaObj.items, spec, depth + 1);
        return `<span class="sc-array">Array&lt;${itemHtml}&gt;</span>`;
    }

    if (schemaObj.type === 'object' && schemaObj.properties) {
        const required = new Set(schemaObj.required || []);
        const entries = Object.entries(schemaObj.properties);
        if (entries.length === 0) return '<span class="sc-empty">Empty object</span>';

        let html = '';
        if (depth > 0) {
            html += `<details class="sc-fields-details" ${depth < 2 ? 'open' : ''}>
              <summary class="sc-fields-summary">${entries.length} fields</summary>
              <div class="sc-fields">`;
        }
        entries.forEach(([name, prop]) => {
            const isReq = required.has(name) ? ' sc-required' : '';
            const badge = required.has(name) ? '<span class="sc-req-badge">req</span>' : '';
            const typeHtml = renderSchemaFields(prop, spec, depth + 1);
            html += `<div class="sc-field${isReq}">
              <span class="sc-field-name">${escHtml(name)}</span>
              ${badge}
              <span class="sc-field-type">${typeHtml}</span>
            </div>`;
        });
        if (depth > 0) {
            html += `</div></details>`;
        }
        return html;
    }

    if (schemaObj.enum) {
        const vals = schemaObj.enum.map(v => `"${v}"`).join(' | ');
        return `<span class="sc-enum">enum (${escHtml(vals)})</span>`;
    }

    const typeName = schemaObj.type || 'any';
    const format = schemaObj.format ? `<span class="sc-format">‹${schemaObj.format}›</span>` : '';
    return `<span class="sc-type">${escHtml(typeName)}</span>${format}`;
}

/**
 * Diff two schema property sets for field-level comparison.
 * Returns { onlyA: [...], onlyB: [...], both: [{name, typeA, typeB, match}] }
 */
function diffSchemaProps(propsA, propsB, requiredA, requiredB) {
    const keysA = new Set(Object.keys(propsA || {}));
    const keysB = new Set(Object.keys(propsB || {}));
    const reqA = new Set(requiredA || []);
    const reqB = new Set(requiredB || []);

    const both = [];
    const onlyA = [];
    const onlyB = [];

    keysA.forEach((k) => {
        if (keysB.has(k)) {
            const typeA = schemaTypeLabel(propsA[k]);
            const typeB = schemaTypeLabel(propsB[k]);
            both.push({
                name: k,
                typeA, typeB,
                match: typeA === typeB,
                requiredA: reqA.has(k),
                requiredB: reqB.has(k),
            });
        } else {
            onlyA.push({ name: k, type: schemaTypeLabel(propsA[k]), required: reqA.has(k) });
        }
    });
    keysB.forEach((k) => {
        if (!keysA.has(k)) {
            onlyB.push({ name: k, type: schemaTypeLabel(propsB[k]), required: reqB.has(k) });
        }
    });

    return { both, onlyA, onlyB };
}

/**
 * Get a human-readable type label from an OpenAPI schema property.
 */
function schemaTypeLabel(prop) {
    if (!prop) return 'any';
    if (prop.$ref) return `«${prop.$ref.split('/').pop()}»`;
    if (prop.type === 'array' && prop.items) return `Array<${schemaTypeLabel(prop.items)}>`;
    if (prop.type === 'object') return 'object';
    if (prop.enum) return `enum(${(prop.enum || []).join('|')})`;
    const t = prop.type || 'any';
    return prop.format ? `${t}‹${prop.format}›` : t;
}

/**
 * Resolve a schema to its properties map for comparison.
 */
function resolveSchemaProps(schemaRef, spec) {
    const schema = schemaRef?.$ref ? resolveRef(schemaRef.$ref, spec) || schemaRef : schemaRef;
    if (!schema) return { properties: {}, required: [] };
    if (schema.allOf) {
        const merged = { properties: {}, required: [] };
        schema.allOf.forEach((sub) => {
            const s = sub.$ref ? resolveRef(sub.$ref, spec) || sub : sub;
            if (s.properties) Object.assign(merged.properties, s.properties);
            if (s.required) merged.required = merged.required.concat(s.required);
        });
        return merged;
    }
    return { properties: schema.properties || {}, required: schema.required || [] };
}

/**
 * Render side-by-side comparison of provider vs consumer endpoint.
 */
function renderContractComparison(providerEp, consumerEp, providerSpec, consumerSpec, usedEndpoints) {
    const isConsumed = usedEndpoints.some((u) => u.toLowerCase() === `${providerEp.method} ${providerEp.path}`.toLowerCase());

    let html = `<details class="contract-endpoint ${isConsumed ? '' : 'not-consumed'}" ${isConsumed ? 'open' : ''}>
      <summary class="contract-endpoint-summary">
        <span class="method-badge method-${providerEp.method.toLowerCase()}">${providerEp.method}</span>
        <code class="ep-path">${escHtml(providerEp.path)}</code>
        ${providerEp.summary ? `<span class="ep-summary"> — ${escHtml(providerEp.summary)}</span>` : ''}
        ${!isConsumed ? `<span class="badge badge-warning" style="font-size:9px">not consumed</span>` : ''}
        <span class="contract-badge">${consumerEp ? '⬡ ' + t("contract.matched") : '⬡ ' + t("contract.provider_only_badge")}</span>
      </summary>
      <div class="contract-endpoint-body">`;

    const pParams = providerEp.parameters || [];
    const cParams = consumerEp?.parameters || [];
    if (pParams.length > 0 || cParams.length > 0) {
        html += `<div class="contract-section">
          <div class="contract-section-title">${t("contract.parameters")}</div>
          <div class="comparison-grid">
            <div class="comp-col comp-provider"><span class="comp-col-header">${escHtml(t("contract.api_expects"))}</span>`;
        pParams.forEach((p) => {
            const typeHtml = renderSchemaFields(p.schema || { type: 'string' }, providerSpec, 0);
            html += `<div class="comp-field">${escHtml(p.name)}: ${typeHtml} <span class="sc-type-tag">${escHtml(p.in || '')}</span></div>`;
        });
        if (pParams.length === 0) html += `<span class="sc-empty">—</span>`;
        html += `</div><div class="comp-col comp-consumer"><span class="comp-col-header">${escHtml(t("contract.client_sends"))}</span>`;
        if (cParams.length > 0) {
            cParams.forEach((p) => {
                const typeHtml = consumerSpec ? renderSchemaFields(p.schema || { type: 'string' }, consumerSpec, 0) : '?';
                html += `<div class="comp-field">${escHtml(p.name)}: ${typeHtml} <span class="sc-type-tag">${escHtml(p.in || '')}</span></div>`;
            });
        } else {
            html += `<span class="sc-empty">—</span>`;
        }
        html += `</div></div></div>`;
    }

    const pReqSchema = providerEp.requestBody?.content?.[Object.keys(providerEp.requestBody.content || {})[0]]?.schema;
    const cReqSchema = consumerEp?.requestBody?.content?.[Object.keys(consumerEp.requestBody.content || {})[0]]?.schema;
    if (pReqSchema || cReqSchema) {
        const pProps = resolveSchemaProps(pReqSchema, providerSpec);
        const cProps = consumerSpec ? resolveSchemaProps(cReqSchema, consumerSpec) : { properties: {}, required: [] };
        const diff = diffSchemaProps(pProps.properties, cProps.properties, pProps.required, cProps.required);

        html += `<div class="contract-section">
          <div class="contract-section-title">${t("contract.request_body")}</div>
          <div class="comparison-grid">
            <div class="comp-col comp-provider"><span class="comp-col-header">${escHtml(t("contract.api_expects"))}</span>`;
        if (diff.both.length > 0) {
            diff.both.forEach((f) => {
                html += `<div class="comp-field ${f.match ? 'comp-match' : 'comp-mismatch'}">
                  <span class="comp-field-name">${escHtml(f.name)}</span>
                  <span class="comp-type-a">${escHtml(f.typeA)}</span>
                  ${!f.match ? `<span class="comp-arrow">→</span><span class="comp-type-b">${escHtml(f.typeB)}</span>` : ''}
                  ${f.requiredA ? '<span class="sc-req-badge">req</span>' : ''}
                  <span class="comp-icon ${f.match ? 'comp-icon-ok' : 'comp-icon-warn'}" title="${f.match ? 'match' : 'type mismatch'}">${f.match ? '✓' : '⚠'}</span>
                </div>`;
            });
        }
        diff.onlyA.forEach((f) => {
            html += `<div class="comp-field comp-only-provider">
              <span class="comp-field-name">${escHtml(f.name)}</span>
              <span class="comp-type-a">${escHtml(f.type)}</span>
              ${f.required ? '<span class="sc-req-badge">req</span>' : ''}
              <span class="comp-icon comp-icon-missing" title="missing in consumer">✗</span>
            </div>`;
        });
        if (diff.both.length === 0 && diff.onlyA.length === 0) {
            html += `<span class="sc-empty">—</span>`;
        }
        html += `</div><div class="comp-col comp-consumer"><span class="comp-col-header">${escHtml(t("contract.client_sends"))}</span>`;
        if (diff.both.length > 0) {
            diff.both.forEach((f) => {
                html += `<div class="comp-field ${f.match ? 'comp-match' : 'comp-mismatch'}">
                  <span class="comp-field-name">${escHtml(f.name)}</span>
                  <span class="comp-type-b">${escHtml(f.typeB)}</span>
                  ${!f.match ? `<span class="comp-arrow">←</span><span class="comp-type-a">${escHtml(f.typeA)}</span>` : ''}
                  ${f.requiredB ? '<span class="sc-req-badge">req</span>' : ''}
                </div>`;
            });
        }
        diff.onlyB.forEach((f) => {
            html += `<div class="comp-field comp-only-consumer">
              <span class="comp-field-name">${escHtml(f.name)}</span>
              <span class="comp-type-b">${escHtml(f.type)}</span>
              ${f.required ? '<span class="sc-req-badge">req</span>' : ''}
              <span class="comp-icon comp-icon-extra" title="extra in consumer">+</span>
            </div>`;
        });
        if (diff.both.length === 0 && diff.onlyB.length === 0) {
            html += `<span class="sc-empty">—</span>`;
        }
        html += `</div></div>`;
        if (diff.onlyA.length > 0 || diff.onlyB.length > 0 || diff.both.some(f => !f.match)) {
            html += `<div class="comp-legend">
              <span class="comp-legend-item"><span class="comp-icon comp-icon-missing">✗</span> ${t("contract.provider_only")}</span>
              <span class="comp-legend-item"><span class="comp-icon comp-icon-extra">+</span> ${t("contract.consumer_only")}</span>
              <span class="comp-legend-item"><span class="comp-icon comp-icon-warn">⚠</span> ${t("contract.type_mismatch")}</span>
            </div>`;
        }
        html += `</div>`;
    }

    const pResponses = Object.entries(providerEp.responses || {});
    const cResponses = Object.entries(consumerEp?.responses || {});
    if (pResponses.length > 0 || cResponses.length > 0) {
        html += `<div class="contract-section">
          <div class="contract-section-title">${t("contract.responses")}</div>`;
        const allCodes = new Set([...pResponses.map(([c]) => c), ...cResponses.map(([c]) => c)]);
        allCodes.forEach((code) => {
            const pResp = providerEp.responses[code];
            const cResp = consumerEp?.responses[code];
            const pSchema = pResp?.content?.[Object.keys(pResp.content || {})[0]]?.schema;
            const cSchema = cResp?.content?.[Object.keys(cResp.content || {})[0]]?.schema;

            html += `<details class="contract-response" ${code.startsWith('2') ? 'open' : ''}>
              <summary class="contract-response-summary">
                <span class="sc-status-code sc-status-${code[0]}">${code}</span>
                ${pResp?.description ? escHtml(pResp.description) : (cResp?.description ? escHtml(cResp.description) : '')}
                ${!pResp ? '<span class="badge badge-warning" style="font-size:9px">provider: missing</span>' : ''}
                ${!cResp ? '<span class="badge badge-warning" style="font-size:9px">consumer: missing</span>' : ''}
              </summary>
              <div class="contract-response-body">
                <div class="comparison-grid">`;

            if (pSchema || cSchema) {
                const pProps = pSchema ? resolveSchemaProps(pSchema, providerSpec) : { properties: {}, required: [] };
                const cProps = cSchema && consumerSpec ? resolveSchemaProps(cSchema, consumerSpec) : { properties: {}, required: [] };
                const diff = diffSchemaProps(pProps.properties, cProps.properties, pProps.required, cProps.required);

                html += `<div class="comp-col comp-provider"><span class="comp-col-header">${escHtml(t("contract.api_returns"))}</span>`;
                diff.both.forEach((f) => {
                    html += `<div class="comp-field ${f.match ? 'comp-match' : 'comp-mismatch'}">
                      <span class="comp-field-name">${escHtml(f.name)}</span>
                      <span class="comp-type-a">${escHtml(f.typeA)}</span>
                      ${!f.match ? `<span class="comp-arrow">→</span><span class="comp-type-b">${escHtml(f.typeB)}</span>` : ''}
                      <span class="comp-icon ${f.match ? 'comp-icon-ok' : 'comp-icon-warn'}">${f.match ? '✓' : '⚠'}</span>
                    </div>`;
                });
                diff.onlyA.forEach((f) => {
                    html += `<div class="comp-field comp-only-provider">
                      <span class="comp-field-name">${escHtml(f.name)}</span>
                      <span class="comp-type-a">${escHtml(f.type)}</span>
                      <span class="comp-icon comp-icon-missing" title="missing in consumer">✗</span>
                    </div>`;
                });
                if (diff.both.length === 0 && diff.onlyA.length === 0) html += `<span class="sc-empty">—</span>`;
                html += `</div><div class="comp-col comp-consumer"><span class="comp-col-header">${escHtml(t("contract.client_receives"))}</span>`;
                diff.both.forEach((f) => {
                    html += `<div class="comp-field ${f.match ? 'comp-match' : 'comp-mismatch'}">
                      <span class="comp-field-name">${escHtml(f.name)}</span>
                      <span class="comp-type-b">${escHtml(f.typeB)}</span>
                    </div>`;
                });
                diff.onlyB.forEach((f) => {
                    html += `<div class="comp-field comp-only-consumer">
                      <span class="comp-field-name">${escHtml(f.name)}</span>
                      <span class="comp-type-b">${escHtml(f.type)}</span>
                      <span class="comp-icon comp-icon-extra" title="extra in consumer">+</span>
                    </div>`;
                });
                if (diff.both.length === 0 && diff.onlyB.length === 0) html += `<span class="sc-empty">—</span>`;
                html += `</div>`;
            } else {
                html += `<span class="sc-empty">No schema</span>`;
            }
            html += `</div></div></details>`;
        });
        html += `</div>`;
    }

    html += `</div></details>`;
    return html;
}
function parseOpenApiEndpoints(spec) {
    if (!spec || !spec.paths) return [];

    const endpoints = [];
    const methodOrder = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const method of methodOrder) {
            const operation = pathItem[method];
            if (!operation) continue;
            endpoints.push({
                method: method.toUpperCase(),
                path,
                summary: operation.summary || operation.operationId || '',
                description: operation.description || '',
                parameters: operation.parameters || [],
                requestBody: operation.requestBody || null,
                responses: operation.responses || {},
                deprecated: operation.deprecated || false,
            });
        }
    }
    return endpoints;
}

/**
 * Resolve a $ref like "#/components/schemas/Pet" within a spec.
 */
function resolveRef(ref, spec) {
    if (!ref || !ref.startsWith('#/')) return ref;
    const parts = ref.split('/').slice(1);
    let obj = spec;
    for (const p of parts) {
        if (obj == null) return ref;
        obj = obj[p];
    }
    return obj;
}

/**
 * Get the schema name from an OpenAPI media type object.
 */
function getSchemaName(contentObj, spec) {
    if (!contentObj) return null;
    const firstType = Object.values(contentObj)[0];
    if (!firstType || !firstType.schema) return null;
    const schema = firstType.schema;
    if (schema.$ref) {
        const refName = schema.$ref.split('/').pop();
        return `«${refName}»`;
    }
    if (schema.type) return `:${schema.type}`;
    return null;
}

function showError(msg) {
    const el = document.getElementById("error-banner");
    if (msg) {
        el.textContent = "⚠ " + msg;
        el.classList.add("visible");
    } else {
        el.classList.remove("visible");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadAll();

    document.getElementById("btn-refresh").addEventListener("click", loadAll);
    document.getElementById("btn-check").addEventListener("click", () => runCheck());
    document.getElementById("btn-cancel-check").addEventListener("click", hideCheckModal);
    document.getElementById("check-modal").addEventListener("click", function(e) {
        if (e.target === this) hideCheckModal();
    });
    document.getElementById("details-close").addEventListener("click", () => {
        hideDetails();
        clearHighlight();
    });

    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = t("nav.dashboard");

    const langBtns = document.querySelectorAll("[data-lang]");
    langBtns.forEach(btn => {
        btn.addEventListener("click", () => switchLocale(btn.dataset.lang));
    });
});

function switchLocale(lang) {
    setLocale(lang);
    applyI18n();

    if (state.schemas.length || state.dependencies.length || state.checks.length) {
        updateStats(state.schemas, state.dependencies, state.checks);
        renderDeps(state.dependencies);
        renderChecks(state.checks);
        renderLegend();
        populateSidebar();
        updatePageMeta(state.schemas, state.dependencies);

        renderServiceTable(state.schemas, state.dependencies);
    }

    const activeNav = document.querySelector(".nav-item.active");
    if (activeNav) {
        const page = activeNav.dataset.page;
        const titleEl = document.getElementById("page-title");
        if (titleEl && page) titleEl.textContent = t("nav." + page);
    }

    document.title = t("app.title");
}
