/* audit.js — vanilla JS, no framework */

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────────
  let state = {
    table:       "sku",   // "sku" or "restock"
    change_type: ""
  };

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const tableToggleBtns   = document.querySelectorAll(".aud-toggle-btn");
  const changeTypeFilter  = document.getElementById("changeTypeFilter");
  const changeTypeWrap    = document.getElementById("changeTypeWrap");
  const skuTableWrap      = document.getElementById("skuTableWrap");
  const restockTableWrap  = document.getElementById("restockTableWrap");
  const skuTableBody      = document.getElementById("skuTableBody");
  const restockTableBody  = document.getElementById("restockTableBody");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function fetchAudit() {
    const params = new URLSearchParams();
    params.set("table", state.table);
    if (state.table === "sku" && state.change_type) {
      params.set("change_type", state.change_type);
    }

    try {
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.table === "sku" ? renderSku(data) : renderRestock(data);
    } catch (err) {
      console.error("Audit fetch failed:", err);
      state.table === "sku"
        ? (skuTableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Failed to load.</td></tr>`)
        : (restockTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Failed to load.</td></tr>`);
    }
  }

  // ── Render SKU changes ─────────────────────────────────────────────────────
  function renderSku(data) {
    if (data.length === 0) {
      skuTableBody.innerHTML = `<tr><td colspan="6" class="table-empty">No records found.</td></tr>`;
      return;
    }

    skuTableBody.innerHTML = data.map((r, i) => `
      <tr class="table-row" style="animation-delay:${i * 15}ms">
        <td class="item-name">${esc(r.item_name)}</td>
        <td class="item-sku">${esc(r.item_id)}</td>
        <td>${renderBadge(r.change_type)}</td>
        <td class="aud-detail">${esc(r.change_detail)}</td>
        <td class="item-dept">${esc(r.requested_by)}</td>
        <td class="align-right aud-timestamp">${esc(r.timestamp)}</td>
      </tr>
    `).join("");
  }

  // ── Render restock / orders ────────────────────────────────────────────────
  function renderRestock(data) {
    if (data.length === 0) {
      restockTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">No records found.</td></tr>`;
      return;
    }

    restockTableBody.innerHTML = data.map((r, i) => `
      <tr class="table-row" style="animation-delay:${i * 15}ms">
        <td class="item-name">${esc(r.item_name)}</td>
        <td class="item-sku">${esc(r.item_id)}</td>
        <td class="item-rev align-right">+${r.quantity_added}</td>
        <td class="item-dept">${esc(r.requested_by)}</td>
        <td class="align-right aud-timestamp">${esc(r.timestamp)}</td>
      </tr>
    `).join("");
  }

  // ── Change type badge ──────────────────────────────────────────────────────
  function renderBadge(type) {
    const map = {
      add:    { label: "Add",    cls: "badge-add"    },
      delete: { label: "Delete", cls: "badge-delete" },
      update: { label: "Update", cls: "badge-update" }
    };
    const b = map[type] || { label: type, cls: "" };
    return `<span class="aud-badge ${b.cls}">${b.label}</span>`;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  tableToggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tableToggleBtns.forEach(b => b.classList.remove("aud-toggle-btn--active"));
      btn.classList.add("aud-toggle-btn--active");

      state.table = btn.dataset.table;
      state.change_type = "";
      changeTypeFilter.value = "";

      // Show/hide relevant table and filter
      const isSku = state.table === "sku";
      skuTableWrap.style.display     = isSku ? "block" : "none";
      restockTableWrap.style.display = isSku ? "none"  : "block";
      changeTypeWrap.style.display   = isSku ? "block" : "none";

      fetchAudit();
    });
  });

  changeTypeFilter.addEventListener("change", () => {
    state.change_type = changeTypeFilter.value;
    fetchAudit();
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  fetchAudit();

})();