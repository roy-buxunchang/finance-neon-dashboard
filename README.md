# NEON FINANCE：个人财务可视化仪表盘（GitHub Pages）

一个部署在 GitHub Pages 的纯静态单页小工具，用两条横向霓虹进度条直观展示：

- **本月剩余天数**（自动计算）
- **本月预算剩余比例**（手动输入 + localStorage 持久化）

---

## 在线预览（Live Demo）

- GitHub Pages：`https://roy-buxunchang.github.io/finance-neon-dashboard/`

---

## 功能特性

### 1) 本月剩余天数进度
- 自动读取当前日期
- 计算当月总天数与剩余天数
- 以横向进度条显示“剩余百分比”
- 默认“剩余天数”**包含今天**

### 2) 月度预算剩余进度
- 输入：
  - 本月总预算
  - 当前剩余预算
- 自动计算剩余比例并更新进度条
- 支持一键保存到 **localStorage**
- 刷新页面数据不丢失（同一设备/浏览器/域名下）
