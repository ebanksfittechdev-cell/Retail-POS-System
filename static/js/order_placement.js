

(function () {
  "use strict";

  const DELIVERY_MS = 60000; // 1 minute demo delay

  // ── State ──────────────────────────────────────────────────────────────────
  let state = {
    data: [],
    search: "",
    department: "",
    // pending: { item_id -> { item_name, quantity, resolveAt } }
    pending: {}
  };

  let debounceTimer = null;
  let countdownInterval = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const searchInput      = document.getElementById("searchInput");
  const departmentFilter = document.getElementById("departmentFilter");
  const tableBody        = document.getElementById("orderTableBody");
  const toastEl          = document.getElementById("ordToast");
  const pendingPanel     = document.getElementById("ordPendingPanel");
  const pendingList      = document.getElementById("ordPendingList");

  // ── Fetch items from /api/movement (has stock, sku, price, department) ─────
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
      const all = await res.json();
      const depts = [...new Set(all.map(r => r.department))].sort();
      depts.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        departmentFilter.appendChild(opt);
      });
    } catch (_) {}
  }

  // ── Render table ───────────────────────────────────────────────────────────
  function renderTable() {
    if (state.data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="table-empty">No items found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = state.data.map((r, i) => {
      const isPending = !!state.pending[r.item_id];
      const stockId   = `stock-${r.item_id}`;

      return `
        <tr class="table-row" style="animation-delay:${i * 20}ms">
          <td class="item-name">${esc(r.item_name)}</td>
          <td class="item-sku">${esc(r.item_id)}</td>
          <td class="item-dept">${esc(r.department)}</td>
          <td class="item-rev align-right">$${r.price !== undefined ? r.price.toFixed(2) : "—"}</td>
          <td class="item-rev align-right" id="${stockId}">${r.amount}</td>
          <td class="align-right">
            <input
              type="number"
              class="qty-input"
              id="qty-${esc(r.item_id)}"
              min="1"
              placeholder="0"
              ${isPending ? "disabled" : ""}
            />
          </td>
          <td class="align-right">
            <button
              class="btn-place-order ${isPending ? "btn-order-pending" : ""}"
              data-id="${esc(r.item_id)}"
              data-name="${esc(r.item_name)}"
              ${isPending ? "disabled" : ""}
            >${isPending ? "Pending…" : "Order"}</button>
          </td>
        </tr>
      `;
    }).join("");

    tableBody.querySelectorAll(".btn-place-order").forEach(btn => {
      btn.addEventListener("click", handleOrder);
    });
  }

  // ── Handle order ───────────────────────────────────────────────────────────
  async function handleOrder(e) {
    const btn      = e.currentTarget;
    const itemId   = btn.dataset.id;
    const itemName = btn.dataset.name;
    const qtyInput = document.getElementById(`qty-${itemId}`);
    const quantity = parseInt(qtyInput?.value, 10);

    if (!quantity || quantity <= 0) {
      showToast("Enter a valid quantity first.", "error");
      return;
    }

    btn.disabled    = true;
    btn.textContent = "Placing…";

    try {
      const res = await fetch("/api/place_order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, quantity })
      });

      const data = await res.json();

      if (res.ok && data.status === "success") {
        showToast(`Order placed — ${itemName} ×${quantity}. Arriving in 1 minute.`, "success");
        btn.textContent = "Pending…";
        btn.classList.add("btn-order-pending");
        if (qtyInput) qtyInput.disabled = true;

        // Register pending order — JS handles the visual countdown
        registerPending(itemId, itemName, quantity, data.new_stock);
      } else {
        showToast(data.message || "Order failed.", "error");
        btn.disabled    = false;
        btn.textContent = "Order";
      }
    } catch (_) {
      showToast("Network error. Try again.", "error");
      btn.disabled    = false;
      btn.textContent = "Order";
    }
  }

  // ── Pending tracking ───────────────────────────────────────────────────────
  function registerPending(itemId, itemName, quantity, newStock) {
    const resolveAt = Date.now() + DELIVERY_MS;

    state.pending[itemId] = { itemId, itemName, quantity, resolveAt, newStock };

    setTimeout(() => resolveOrder(itemId), DELIVERY_MS);

    renderPendingPanel();
    startCountdown();
  }

  function resolveOrder(itemId) {
    const order = state.pending[itemId];
    if (!order) return;

    // Update the stock cell in the table directly
    const stockEl = document.getElementById(`stock-${itemId}`);
    if (stockEl) stockEl.textContent = order.newStock;

    // Re-enable the button
    const btn = tableBody.querySelector(`[data-id="${itemId}"]`);
    if (btn) {
      btn.disabled    = false;
      btn.textContent = "Order";
      btn.classList.remove("btn-order-pending");
    }

    const qtyInput = document.getElementById(`qty-${itemId}`);
    if (qtyInput) {
      qtyInput.disabled = false;
      qtyInput.value    = "";
    }

    delete state.pending[itemId];
    showToast(`Shipment received — ${order.itemName} stock updated.`, "success");
    renderPendingPanel();
  }

  // ── Pending panel ──────────────────────────────────────────────────────────
  function renderPendingPanel() {
    const orders = Object.values(state.pending);
    pendingPanel.style.display = orders.length ? "block" : "none";

    pendingList.innerHTML = orders.map(o => `
      <div class="ord-pending-row">
        <span class="ord-pending-name">${esc(o.itemName)}</span>
        <span class="ord-pending-qty">×${o.quantity}</span>
        <span class="ord-pending-timer" id="ptimer-${esc(o.itemId)}">—</span>
        <span class="ord-pending-badge">In transit</span>
      </div>
    `).join("");
  }

  function startCountdown() {
    if (countdownInterval) return;
    countdownInterval = setInterval(() => {
      const orders = Object.values(state.pending);
      if (orders.length === 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        return;
      }
      orders.forEach(o => {
        const el = document.getElementById(`ptimer-${o.itemId}`);
        if (!el) return;
        const secs = Math.max(0, Math.ceil((o.resolveAt - Date.now()) / 1000));
        el.textContent = `${secs}s`;
      });
    }, 1000);
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  let toastTimer = null;

  function showToast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className   = `ord-toast ord-toast--${type} ord-toast--show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("ord-toast--show");
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