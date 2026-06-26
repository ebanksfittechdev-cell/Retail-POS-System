

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────────
  let state = {
    data: [],
    search: "",
    department: "",
    sort: "desc",
  };

  let chart = null;
  let debounceTimer = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const searchInput       = document.getElementById("searchInput");
  const departmentFilter  = document.getElementById("departmentFilter");
  const sortToggle        = document.getElementById("sortToggle");
  const simulateBtn       = document.getElementById("simulateBtn");
  const tableBody         = document.getElementById("revenueTableBody");
  const chartEmpty        = document.getElementById("chartEmpty");
  const chartSubtitle     = document.getElementById("chartSubtitle");
  const totalRevenueEl    = document.getElementById("totalRevenue");
  const topItemEl         = document.getElementById("topItem");
  const itemCountEl       = document.getElementById("itemCount");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function fetchRevenue() {
    const params = new URLSearchParams();
    if (state.search)     params.set("search", state.search);
    if (state.department) params.set("department", state.department);
    params.set("sort", state.sort);

    try {
      const res = await fetch(`/api/revenue?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch (err) {
      console.error("Revenue fetch failed:", err);
      state.data = [];
    }

    render();
  }

  // ── Populate department dropdown (once, from first full fetch) ─────────────
  async function bootstrapDepartments() {
    try {
      const res = await fetch("/api/revenue");
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

  function fmt(n) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderSummary() {
    const total = state.data.reduce((s, r) => s + r.revenue, 0);
    totalRevenueEl.textContent = state.data.length ? fmt(total) : "—";
    topItemEl.textContent      = state.data.length ? state.data[0].item_name : "—";
    itemCountEl.textContent    = state.data.length || "—";

    // Update chart subtitle
    chartSubtitle.textContent = state.department
      ? state.department
      : "All departments";
  }

  function renderChart() {
    const canvas = document.getElementById("revenueChart");
    const ctx = canvas.getContext("2d");
    const isEmpty = state.data.length === 0;

    canvas.style.display   = isEmpty ? "none" : "block";
    chartEmpty.style.display = isEmpty ? "flex" : "none";

    const top = state.data.slice(0, 12); // cap at 12 bars for readability
    const labels   = top.map(r => r.item_name);
    const revenues = top.map(r => r.revenue);

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0,   "rgba(245,245,247,0.85)");
    gradient.addColorStop(1,   "rgba(245,245,247,0.08)");

    const hoverGradient = ctx.createLinearGradient(0, 0, 0, 320);
    hoverGradient.addColorStop(0,   "rgba(255,255,255,1)");
    hoverGradient.addColorStop(1,   "rgba(255,255,255,0.2)");

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = revenues;
      chart.data.datasets[0].backgroundColor = gradient;
      chart.data.datasets[0].hoverBackgroundColor = hoverGradient;
      chart.update("active");
      return;
    }

    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: revenues,
          backgroundColor: gradient,
          hoverBackgroundColor: hoverGradient,
          borderColor: "rgba(245,245,247,0.3)",
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
              label: ctx => fmt(ctx.parsed.y)
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
              callback: v => "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v)
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
          <td colspan="3" class="table-empty">No results found.</td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = state.data.map((r, i) => `
      <tr class="table-row" style="animation-delay:${i * 20}ms">
        <td class="item-name">${escHtml(r.item_name)}</td>
        <td class="item-dept">${escHtml(r.department)}</td>
        <td class="item-rev align-right">${fmt(r.revenue)}</td>
      </tr>
    `).join("");
  }

  function escHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      fetchRevenue();
    }, 280);
  });

  departmentFilter.addEventListener("change", () => {
    state.department = departmentFilter.value;
    fetchRevenue();
  });

  sortToggle.addEventListener("click", () => {
    state.sort = state.sort === "desc" ? "asc" : "desc";
    sortToggle.dataset.sort = state.sort;
    sortToggle.querySelector(".sort-label").textContent =
      state.sort === "desc" ? "Highest first" : "Lowest first";
    sortToggle.querySelector(".sort-arrow").style.transform =
      state.sort === "asc" ? "rotate(180deg)" : "";
    fetchRevenue();
  });

  simulateBtn.addEventListener("click", async () => {
    simulateBtn.disabled = true;
    simulateBtn.textContent = "…";
    try {
      await fetch("/api/simulate", { method: "POST" });
    } catch (_) {}
    // Small delay so the DB write settles before re-fetch
    setTimeout(() => {
      fetchRevenue();
      simulateBtn.disabled = false;
      simulateBtn.textContent = "Simulate Sale";
    }, 300);
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  bootstrapDepartments().then(fetchRevenue);

})();
