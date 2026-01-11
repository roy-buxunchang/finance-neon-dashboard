/* ====== localStorage 键名（你可以改，但要保持一致）====== */
const LS_TOTAL = "pf_totalBudget";
const LS_REMAIN = "pf_remainingBudget";

/* ====== 一些小工具函数 ====== */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* ====== 日期：本月总天数、剩余天数（默认包含今天）====== */
function getMonthInfo(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();    // 1-31

  // 当月总天数：下个月第 0 天 = 本月最后一天
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 剩余天数：包含今天
  const remainingDays = daysInMonth - day + 1;

  const remainingPct = (remainingDays / daysInMonth) * 100;
  return { year, month, day, daysInMonth, remainingDays, remainingPct };
}

/* ====== 读取/保存预算数据 ====== */
function loadBudget() {
  const totalRaw = localStorage.getItem(LS_TOTAL);
  const remainRaw = localStorage.getItem(LS_REMAIN);

  // 默认值（第一次打开时用）
  const defaultTotal = 10000;
  const defaultRemain = 6000;

  const total = totalRaw === null ? defaultTotal : toNumber(totalRaw, defaultTotal);
  const remain = remainRaw === null ? defaultRemain : toNumber(remainRaw, defaultRemain);

  return { total, remain, hasSaved: (totalRaw !== null || remainRaw !== null) };
}

function saveBudget(total, remain) {
  localStorage.setItem(LS_TOTAL, String(total));
  localStorage.setItem(LS_REMAIN, String(remain));
}

/* ====== 霓虹渐变（用于条形填充）====== */
function makeNeonGradient(ctx, area, leftColor, rightColor) {
  const g = ctx.createLinearGradient(area.left, 0, area.right, 0);
  g.addColorStop(0, leftColor);
  g.addColorStop(1, rightColor);
  return g;
}

/* ====== Chart.js：把“横向堆叠条形图”做成进度条 ====== */
function createProgressChart(canvas, theme) {
  const ctx = canvas.getContext("2d");

  // 自定义插件：在图中央写字（百分比 + 文案）
  const centerTextPlugin = {
    id: "centerTextPlugin",
    afterDatasetsDraw(chart, args, pluginOptions) {
      const { ctx, chartArea } = chart;
      const text1 = pluginOptions?.text1 ?? "";
      const text2 = pluginOptions?.text2 ?? "";
      const glow = pluginOptions?.glow ?? "rgba(35,247,255,0.22)";

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;

      // 发光效果
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;

      ctx.fillStyle = "rgba(245,250,255,0.92)";
      ctx.font = "700 16px Orbitron, Inter, sans-serif";
      ctx.fillText(text1, cx, cy - 10);

      ctx.shadowBlur = 10;
      ctx.fillStyle = "rgba(245,250,255,0.70)";
      ctx.font = "600 12px Inter, sans-serif";
      ctx.fillText(text2, cx, cy + 12);

      ctx.restore();
    }
  };

  const data = {
    labels: ["progress"],
    datasets: [
      // dataset[0]：剩余（亮色）
      {
        label: "剩余",
        data: [50],
        borderWidth: 0,
        borderRadius: 999,
        barThickness: 26,
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return theme.solidA;
          return makeNeonGradient(ctx, chartArea, theme.gradL, theme.gradR);
        }
      },
      // dataset[1]：已用/已过去（暗色底）
      {
        label: "已用",
        data: [50],
        borderWidth: 0,
        borderRadius: 999,
        barThickness: 26,
        backgroundColor: theme.track
      }
    ]
  };

  const chart = new Chart(ctx, {
    type: "bar",
    data,
    plugins: [centerTextPlugin],
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        centerTextPlugin: {
          text1: "",
          text2: "",
          glow: theme.glow
        }
      },
      scales: {
        x: {
          stacked: true,
          min: 0,
          max: 100,
          display: false,
          grid: { display: false }
        },
        y: {
          stacked: true,
          display: false,
          grid: { display: false }
        }
      },
      layout: { padding: { left: 6, right: 6, top: 8, bottom: 8 } }
    }
  });

  return chart;
}

/* ====== 更新图表数据（把“剩余/已用”拼成 100%）====== */
function setChartPercent(chart, remainingPercent, text1, text2) {
  const r = clamp(remainingPercent, 0, 100);
  const used = 100 - r;

  chart.data.datasets[0].data = [r];
  chart.data.datasets[1].data = [used];

  chart.options.plugins.centerTextPlugin.text1 = text1;
  chart.options.plugins.centerTextPlugin.text2 = text2;

  chart.update();
}

/* ====== 页面逻辑 ====== */
document.addEventListener("DOMContentLoaded", () => {
  const daysChip = document.getElementById("daysChip");
  const budgetChip = document.getElementById("budgetChip");
  const daysHint = document.getElementById("daysHint");

  const totalInput = document.getElementById("totalBudget");
  const remainInput = document.getElementById("remainingBudget");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusText = document.getElementById("statusText");

  // 读取预算（localStorage）
  const budget = loadBudget();
  totalInput.value = String(budget.total);
  remainInput.value = String(budget.remain);

  if (!budget.hasSaved) {
    statusText.textContent = "提示：这是默认值。输入你的真实预算后点击“保存”，下次打开会自动记住。";
  } else {
    statusText.textContent = "已从 localStorage 读取上次保存的数据。修改后可再次点击“保存”。";
  }

  // 创建两张霓虹进度条图
  const daysChart = createProgressChart(
    document.getElementById("daysChart"),
    {
      solidA: "rgba(35,247,255,0.95)",
      gradL: "#23f7ff",
      gradR: "#a855ff",
      track: "rgba(255,255,255,0.10)",
      glow: "rgba(35,247,255,0.22)"
    }
  );

  const budgetChart = createProgressChart(
    document.getElementById("budgetChart"),
    {
      solidA: "rgba(53,255,154,0.95)",
      gradL: "#35ff9a",
      gradR: "#23f7ff",
      track: "rgba(255,255,255,0.10)",
      glow: "rgba(53,255,154,0.20)"
    }
  );

  // 更新“本月剩余天数”
  function refreshDays() {
    const info = getMonthInfo(new Date());
    const pct = clamp(info.remainingPct, 0, 100);

    const text1 = `${pct.toFixed(1)}%`;
    const text2 = `剩余 ${info.remainingDays} / ${info.daysInMonth} 天`;

    setChartPercent(daysChart, pct, text1, text2);

    daysChip.textContent = `${info.remainingDays}天`;
    daysHint.textContent =
      `说明：今天是 ${info.month + 1} 月 ${info.day} 日，本月共 ${info.daysInMonth} 天；默认“剩余天数”包含今天。`;
  }

  // 更新“预算剩余”
  function refreshBudget() {
    const total = toNumber(totalInput.value, 0);
    const remain = toNumber(remainInput.value, 0);

    // 防止除以 0
    const pct = total > 0 ? (remain / total) * 100 : 0;
    const safePct = clamp(pct, 0, 100);

    const text1 = `${safePct.toFixed(1)}%`;
    const text2 = total > 0
      ? `剩余 ¥${remain.toFixed(2)} / ¥${total.toFixed(2)}`
      : "请先填写本月总预算";

    setChartPercent(budgetChart, safePct, text1, text2);

    budgetChip.textContent = total > 0 ? `¥${remain.toFixed(0)}` : "--";
  }

  // 初次刷新
  refreshDays();
  refreshBudget();

  // 输入变化时实时更新图表（不强制保存）
  totalInput.addEventListener("input", refreshBudget);
  remainInput.addEventListener("input", refreshBudget);

  // 点击保存：写入 localStorage
  saveBtn.addEventListener("click", () => {
    const total = toNumber(totalInput.value, 0);
    const remain = toNumber(remainInput.value, 0);

    // 简单校验
    if (total < 0 || remain < 0) {
      statusText.textContent = "数值不能为负数。请修正后再保存。";
      return;
    }
    if (total === 0) {
      statusText.textContent = "总预算为 0 时无法计算比例。请先填写总预算再保存。";
      return;
    }

    saveBudget(total, remain);
    statusText.textContent = "已保存到 localStorage。刷新页面也不会丢。";
    refreshBudget();
  });

  // 清空并重置
  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(LS_TOTAL);
    localStorage.removeItem(LS_REMAIN);

    // 恢复默认
    totalInput.value = "10000";
    remainInput.value = "6000";
    statusText.textContent = "已清空 localStorage，并恢复默认值。你可以重新输入并保存。";
    refreshBudget();
  });

  // 每天跨日时，剩余天数应变化；这里每 10 分钟刷新一次（轻量级）
  setInterval(refreshDays, 10 * 60 * 1000);
});
