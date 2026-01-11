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

// 自定义插件：高对比 HUD 文本（默认画在 bar 上方，不重叠，更色盲友好）
const centerTextPlugin = {
  id: "centerTextPlugin",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx, chartArea } = chart;
    const text1 = pluginOptions?.text1 ?? "";
    const text2 = pluginOptions?.text2 ?? "";
    const glow  = pluginOptions?.glow  ?? "rgba(35,247,255,0.22)";

    // mode: "above"（推荐：不重叠） 或 "inside"（仍在条内，但带强对比底）
    const mode = pluginOptions?.mode ?? "above";

    if (!text1 && !text2) return;

    // 取第一个 dataset 的 bar 元素，拿到 y 和高度，用来定位“条在哪里”
    const meta = chart.getDatasetMeta(0);
    const el = meta?.data?.[0];
    if (!el) return;

    const barY = el.y;
    const barH = el.height ?? 26;

    // 字体与布局参数
    const line1 = 16;      // text1 视觉字号
    const line2 = 12;      // text2 视觉字号
    const gap   = 6;
    const padX  = 12;
    const padY  = 10;

    const font1 = `700 ${line1}px Orbitron, Inter, sans-serif`;
    const font2 = `600 ${line2}px Inter, sans-serif`;

    // 计算文本宽度，确定“HUD 标签”宽高
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = font1;
    const w1 = ctx.measureText(text1).width;
    ctx.font = font2;
    const w2 = ctx.measureText(text2).width;

    const boxW = Math.ceil(Math.max(w1, w2) + padX * 2);
    const boxH = Math.ceil(padY * 2 + line1 + gap + line2);

    // 目标位置：默认放在 bar 上方，避免重叠
    const cx = (chartArea.left + chartArea.right) / 2;

    let x = cx - boxW / 2;
    x = Math.max(chartArea.left + 6, Math.min(x, chartArea.right - boxW - 6));

    let y;
    if (mode === "inside") {
      // 仍在 bar 内：靠近 bar 中心
      y = barY - boxH / 2;
    } else {
      // 推荐：bar 上方
      y = barY - barH / 2 - boxH - 10;
      // 如果空间太小，就贴到 chartArea 顶部一点点（仍不会盖住 bar）
      y = Math.max(chartArea.top + 6, y);
    }

    // 画圆角矩形 HUD
    const r = 12;
    const drawRoundRect = (rx, ry, rw, rh, rr) => {
      ctx.beginPath();
      ctx.moveTo(rx + rr, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
      ctx.arcTo(rx, ry + rh, rx, ry, rr);
      ctx.arcTo(rx, ry, rx + rw, ry, rr);
      ctx.closePath();
    };

    // HUD 背景（深色，提高对比度）
    drawRoundRect(x, y, boxW, boxH, r);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();

    // HUD 描边（霓虹）
    ctx.lineWidth = 1;
    ctx.strokeStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.stroke();

    // 文本：强对比“黑描边 + 白填充”（色盲/低对比屏幕更稳）
    const t1y = y + padY + line1 / 2;
    const t2y = y + padY + line1 + gap + line2 / 2;

    // text1
    ctx.shadowBlur = 0;
    ctx.font = font1;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(text1, x + boxW / 2, t1y);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillText(text1, x + boxW / 2, t1y);

    // text2
    ctx.font = font2;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.80)";
    ctx.strokeText(text2, x + boxW / 2, t2y);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText(text2, x + boxW / 2, t2y);

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
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.28)",
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
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 999,
        barThickness: 26,
        backgroundColor: theme.track
      }
    ]
  };

  const chart = new Chart(ctx, {
    type: "bar",
    data,
    plugins: [],
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
function setChartPercent(chart, remainingPercent) {
  const r = clamp(remainingPercent, 0, 100);
  const used = 100 - r;

  chart.data.datasets[0].data = [r];
  chart.data.datasets[1].data = [used];

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

  const daysHudMain = document.getElementById("daysHudMain");
  const daysHudSub  = document.getElementById("daysHudSub");
  const budgetHudMain = document.getElementById("budgetHudMain");
  const budgetHudSub  = document.getElementById("budgetHudSub");

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

    // 更新 bar
    setChartPercent(daysChart, pct);

    // 更新 HUD（完全脱离 bar）
    daysHudMain.textContent = `${pct.toFixed(1)}%`;
    daysHudSub.textContent  = `剩余 ${info.remainingDays} / ${info.daysInMonth} 天`;

    // 其他原有 UI（你已有的）
    daysChip.textContent = `${info.remainingDays}天`;
    daysHint.textContent =
      `说明：今天是 ${info.month + 1} 月 ${info.day} 日，本月共 ${info.daysInMonth} 天；默认“剩余天数”包含今天。`;
  }


  // 更新“预算剩余”
  function refreshBudget() {
    const total = toNumber(totalInput.value, 0);
    const remain = toNumber(remainInput.value, 0);

    const pct = total > 0 ? (remain / total) * 100 : 0;
    const safePct = clamp(pct, 0, 100);

    // 更新 bar
    setChartPercent(budgetChart, safePct);

    // 更新 HUD（完全脱离 bar）
    budgetHudMain.textContent = `${safePct.toFixed(1)}%`;
    budgetHudSub.textContent = total > 0
      ? `剩余 ¥${remain.toFixed(2)} / ¥${total.toFixed(2)}`
      : "请先填写本月总预算";

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
