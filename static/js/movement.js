/* movement.js — vanilla JS, no framework */

(function () {
  "use strict";

  const LOW_STOCK_THRESHOLD = 20;

  // ── State ──────────────────────────────────────────────────────────────────
  let state = {
    data: [],
    department: "",
    sort: "asc",
  };

  let chart = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const departmentFilter  = document.getElementById("departmentFilter");
  const sortToggle        = document.getElementById("sortToggle");
  const tableBody         = document.getElementById("movementTableBody");
  const chartEmpty        = document.getElementById("chartEmpty");
  const chartSubtitle     = document.getElementById("chartSubtitle");
  const totalUnitsEl      = document.getElementById("totalUnits");
  const lowStockCountEl   = document.getElementById("lowStockCount");
  const itemCountEl       = document.getElementById("itemCount");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function fetchMovement() {
    const params = new URLSearchParams();
    if (state.department) params.set("department", state.department);
    params.set("sort", state.sort);

    try {
      const res = await fetch(`/api/movement?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch (err) {
      console.error("Movement fetch failed:", err);
      state.data = [];
    }

    render();
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

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    renderSummary();
    renderChart();
    renderTable();
  }

  function renderSummary() {
    const total    = state.data.reduce((s, r) => s + r.amount, 0);
    const lowCount = state.data.filter(r => r.amount < LOW_STOCK_THRESHOLD).length;

    totalUnitsEl.textContent   = state.data.length ? total.toLocaleString() : "—";
    lowStockCountEl.textContent = state.data.length ? lowCount : "—";
    itemCountEl.textContent    = state.data.length || "—";

    chartSubtitle.textContent = state.department || "All departments";

    // Turn low stock summary card red if any items are critical
    const lowCard = lowStockCountEl.closest(".summary-card");
    if (lowCount > 0) {
      lowCard.classList.add("summary-card--alert");
    } else {
      lowCard.classList.remove("summary-card--alert");
    }
  }

  function renderChart() {
    const canvas  = document.getElementById("movementChart");
    const ctx     = canvas.getContext("2d");
    const isEmpty = state.data.length === 0;

    canvas.style.display     = isEmpty ? "none" : "block";
    chartEmpty.style.display = isEmpty ? "flex" : "none";

    const top     = state.data.slice(0, 15);
    const labels  = top.map(r => r.item_name);
    const amounts = top.map(r => r.amount);

    // Color each bar: red if low stock, white otherwise
    const barColors = amounts.map(a =>
      a < LOW_STOCK_THRESHOLD
        ? "rgba(255, 69, 58, 0.75)"
        : "rgba(245, 245, 247, 0.75)"
    );

    const hoverColors = amounts.map(a =>
      a < LOW_STOCK_THRESHOLD
        ? "rgba(255, 69, 58, 1)"
        : "rgba(255, 255, 255, 1)"
    );

    if (chart) {
      chart.data.labels                              = labels;
      chart.data.datasets[0].data                   = amounts;
      chart.data.datasets[0].backgroundColor        = barColors;
      chart.data.datasets[0].hoverBackgroundColor   = hoverColors;
      chart.update("active");
      return;
    }

    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: amounts,
          backgroundColor: barColors,
          hoverBackgroundColor: hoverColors,
          borderColor: "rgba(245,245,247,0.15)",
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 400,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1a1a1a",
            borderColor: "#2a2a2a",
            borderWidth: 1,
            titleColor: "#86868b",
            bodyColor: "#f5f5f7",
            titleFont: { size: 11, family: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" },
            bodyFont:  { size: 13, weight: "500", family: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" },
            padding: 12,
            callbacks: {
              label: ctx => `${ctx.parsed.y} units`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: "#86868b",
              font: { size: 11, family: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" },
              maxRotation: 30,
              minRotation: 0,
            }
          },
          y: {
            grid: {
              color: "rgba(255,255,255,0.05)",
              drawBorder: false,
            },
            border: { display: false, dash: [4, 4] },
            ticks: {
              color: "#86868b",
              font: { size: 11, family: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" },
              callback: v => v + " u"
            }
          }
        }
      }
    });
  }

  function renderTable() {
    if (state.data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">No results found.</td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = state.data.map((r, i) => {
      const isLow = r.amount < LOW_STOCK_THRESHOLD;
      return `
        <tr class="table-row" style="animation-delay:${i * 20}ms">
          <td class="item-name">${escHtml(r.item_name)}</td>
          <td class="item-sku">${escHtml(r.item_id)}</td>
          <td class="item-dept">${escHtml(r.department)}</td>
          <td class="item-rev align-right">${r.amount}</td>
          <td class="align-right">
            ${isLow ? '<span class="badge-low">Low stock</span>' : ''}
          </td>
        </tr>
      `;
    }).join("");
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  departmentFilter.addEventListener("change", () => {
    state.department = departmentFilter.value;
    fetchMovement();
  });

  sortToggle.addEventListener("click", () => {
    state.sort = state.sort === "asc" ? "desc" : "asc";
    sortToggle.dataset.sort = state.sort;
    sortToggle.querySelector(".sort-label").textContent =
      state.sort === "asc" ? "Lowest first" : "Highest first";
    sortToggle.querySelector(".sort-arrow").style.transform =
      state.sort === "desc" ? "rotate(180deg)" : "";
    fetchMovement();
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  bootstrapDepartments().then(fetchMovement);

})();