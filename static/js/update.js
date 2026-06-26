/* update.js — vanilla JS, no framework */

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────────
  let state = {
    data: [],
    search: "",
    department: "",
    pendingDeactivate: null  // item_id awaiting confirm
  };

  let debounceTimer = null;
  let toastTimer    = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const searchInput      = document.getElementById("searchInput");
  const departmentFilter = document.getElementById("departmentFilter");
  const tableBody        = document.getElementById("updateTableBody");
  const toastEl          = document.getElementById("updToast");

  // Confirm modal
  const confirmOverlay   = document.getElementById("confirmOverlay");
  const confirmBody      = document.getElementById("confirmBody");
  const confirmCancel    = document.getElementById("confirmCancel");
  const confirmYes       = document.getElementById("confirmYes");

  // Add SKU modal
  const addOverlay       = document.getElementById("addOverlay");
  const btnAddSku        = document.getElementById("btnAddSku");
  const addCancel        = document.getElementById("addCancel");
  const addSubmit        = document.getElementById("addSubmit");
  const addName          = document.getElementById("addName");
  const addPrice         = document.getElementById("addPrice");
  const addAmount        = document.getElementById("addAmount");
  const addDeptGroup     = document.getElementById("addDeptGroup");
  const addError         = document.getElementById("addError");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function fetchItems() {
    const params = new URLSearchParams();
    if (state.search)     params.set("search", state.search);
    if (state.department) params.set("department", state.department);

    try {
      const res = await fetch(`/api/movement?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch (err) {
      console.error("Fetch failed:", err);
      state.data = [];
    }

    renderTable();
  }

  // ── Bootstrap departments ──────────────────────────────────────────────────
  async function bootstrapDepartments() {
    try {
      const res = await fetch("/api/movement");
      if (!res.ok) return;
      const all  = await res.json();
      const depts = [...new Set(all.map(r => r.department))].sort();

      depts.forEach(d => {
        // Dropdown filter
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        departmentFilter.appendChild(opt);

        // Radio buttons in Add SKU modal
        const label = document.createElement("label");
        label.className = "radio-label";
        label.innerHTML = `<input type="radio" name="addDept" value="${esc(d)}" /> ${esc(d)}`;
        addDeptGroup.appendChild(label);
      });
    } catch (_) {}
  }

  // ── Render table ───────────────────────────────────────────────────────────
  function renderTable() {
    if (state.data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="table-empty">No items found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = state.data.map((r, i) => `
      <tr class="table-row" style="animation-delay:${i * 20}ms" id="row-${esc(r.item_id)}">
        <td>
          <input
            type="text"
            class="upd-inline-input"
            id="name-${esc(r.item_id)}"
            value="${esc(r.item_name)}"
          />
        </td>
        <td class="item-sku">${esc(r.item_id)}</td>
        <td class="item-dept">${esc(r.department)}</td>
        <td class="align-right">
          <input
            type="number"
            class="upd-inline-input upd-inline-num"
            id="price-${esc(r.item_id)}"
            value="${r.price !== undefined ? r.price.toFixed(2) : ""}"
            min="0"
            step="0.01"
          />
        </td>
        <td class="align-right">
          <input
            type="number"
            class="upd-inline-input upd-inline-num"
            id="amount-${esc(r.item_id)}"
            value="${r.amount}"
            min="0"
          />
        </td>
        <td class="align-right">
          <button
            class="btn-save-row"
            data-id="${esc(r.item_id)}"
          >Save</button>
        </td>
        <td class="align-right">
          <button
            class="btn-deactivate-row"
            data-id="${esc(r.item_id)}"
            data-name="${esc(r.item_name)}"
          >Deactivate</button>
        </td>
      </tr>
    `).join("");

    tableBody.querySelectorAll(".btn-save-row").forEach(btn => {
      btn.addEventListener("click", handleSave);
    });

    tableBody.querySelectorAll(".btn-deactivate-row").forEach(btn => {
      btn.addEventListener("click", handleDeactivateClick);
    });
  }

  // ── Save row ───────────────────────────────────────────────────────────────
  async function handleSave(e) {
    const btn    = e.currentTarget;
    const itemId = btn.dataset.id;

    const item_name = document.getElementById(`name-${itemId}`)?.value.trim();
    const price     = document.getElementById(`price-${itemId}`)?.value;
    const amount    = document.getElementById(`amount-${itemId}`)?.value;

    btn.disabled    = true;
    btn.textContent = "Saving…";

    try {
      const res = await fetch("/api/update_sku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, item_name, price, amount })
      });

      const data = await res.json();

      if (res.ok && data.status === "success") {
        showToast(`${data.item_name} updated.`, "success");
      } else {
        showToast(data.message || "Update failed.", "error");
      }
    } catch (_) {
      showToast("Network error. Try again.", "error");
    }

    btn.disabled    = false;
    btn.textContent = "Save";
  }

  // ── Deactivate — confirm modal ─────────────────────────────────────────────
  function handleDeactivateClick(e) {
    const btn  = e.currentTarget;
    state.pendingDeactivate = btn.dataset.id;
    confirmBody.textContent =
      `"${btn.dataset.name}" will be removed from all active views. This cannot be undone from the dashboard.`;
    confirmOverlay.classList.add("upd-overlay--show");
  }

  confirmCancel.addEventListener("click", () => {
    state.pendingDeactivate = null;
    confirmOverlay.classList.remove("upd-overlay--show");
  });

  confirmYes.addEventListener("click", async () => {
    const itemId = state.pendingDeactivate;
    if (!itemId) return;

    confirmOverlay.classList.remove("upd-overlay--show");
    state.pendingDeactivate = null;

    try {
      const res = await fetch("/api/deactivate_sku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId })
      });

      const data = await res.json();

      if (res.ok && data.status === "success") {
        showToast(data.message, "success");
        // Remove row from table immediately
        const row = document.getElementById(`row-${itemId}`);
        if (row) row.remove();
        // Remove from state
        state.data = state.data.filter(r => r.item_id !== itemId);
      } else {
        showToast(data.message || "Deactivation failed.", "error");
      }
    } catch (_) {
      showToast("Network error. Try again.", "error");
    }
  });

  // ── Add SKU modal ──────────────────────────────────────────────────────────
  btnAddSku.addEventListener("click", () => {
    addName.value  = "";
    addPrice.value = "";
    addAmount.value = "";
    addError.textContent = "";
    const radios = addDeptGroup.querySelectorAll("input[type=radio]");
    radios.forEach(r => r.checked = false);
    addOverlay.classList.add("upd-overlay--show");
  });

  addCancel.addEventListener("click", () => {
    addOverlay.classList.remove("upd-overlay--show");
  });

  addSubmit.addEventListener("click", async () => {
    addError.textContent = "";

    const item_name  = addName.value.trim();
    const price      = addPrice.value;
    const amount     = addAmount.value;
    const deptRadio  = addDeptGroup.querySelector("input[type=radio]:checked");
    const department = deptRadio ? deptRadio.value : "";

    if (!item_name || !price || !amount || !department) {
      addError.textContent = "All fields are required.";
      return;
    }

    addSubmit.disabled    = true;
    addSubmit.textContent = "Adding…";

    try {
      const res = await fetch("/api/add_sku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name, price, amount, department })
      });

      const data = await res.json();

      if (res.ok && data.status === "success") {
        addOverlay.classList.remove("upd-overlay--show");
        showToast(`${data.item_name} added as ${data.item_id}.`, "success");
        fetchItems();
      } else {
        addError.textContent = data.message || "Failed to add item.";
      }
    } catch (_) {
      addError.textContent = "Network error. Try again.";
    }

    addSubmit.disabled    = false;
    addSubmit.textContent = "Add item";
  });

  // Close overlays on backdrop click
  [confirmOverlay, addOverlay].forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        overlay.classList.remove("upd-overlay--show");
        state.pendingDeactivate = null;
      }
    });
  });

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className   = `upd-toast upd-toast--${type} upd-toast--show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("upd-toast--show");
    }, 4000);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      fetchItems();
    }, 280);
  });

  departmentFilter.addEventListener("change", () => {
    state.department = departmentFilter.value;
    fetchItems();
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  bootstrapDepartments().then(fetchItems);

})();