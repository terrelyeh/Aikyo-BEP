# CLAUDE.md — Project Context

> Last updated: 2026-05-04

## Project Overview

愛嬌冰店（Aikyo）的**互動式損益平衡分析工具**。純前端單檔應用，讓經營團隊掌握固定成本結構、找到損益平衡點（BEP），並以此為 baseline 規劃盈利策略。部署在 Vercel（https://aikyo-bep.vercel.app），有密碼閘門保護。

## Tech Stack

- **純 HTML 單檔**（`index.html`），零建置步驟
- Tailwind CSS 3（CDN）
- Chart.js 4.4（CDN）
- 字型：Noto Sans TC（中文）/ Inter（數字，tabular-nums）
- 部署：Vercel（push to main 自動部署，aikyo-bep.vercel.app）
- 密碼閘門：SHA-256 hash 比對，sessionStorage 保持登入

## Directory Structure

```
.
├── index.html      # 唯一的應用程式檔案，包含 HTML + CSS + JS
├── README.md       # 專案說明（對外）
├── CLAUDE.md       # AI session context（本檔）
└── .claude/        # Claude Code 設定
```

沒有 `package.json`、沒有 build pipeline、沒有 node_modules。所有邏輯都在 `index.html` 裡。

## Architecture — index.html 結構

### HTML 區塊（由上到下）

| 區塊 | 說明 |
|---|---|
| Password Gate | SHA-256 密碼閘門，通過後 `sessionStorage` 記住 |
| Header | 標題、標籤（保守版 / 正職 cover 50%）、POS 外連結 |
| LEFT: Controls | 左欄 360px，5 張卡片由上到下 |
| RIGHT: Results | 右欄自適應，結果即時更新 |
| Footer | 免責聲明、GitHub 連結 |

### 左側控制卡片（5 張）

1. **產品設定** — 霜淇淋 / 聖代的售價 + 毛利率 slider
2. **通路設定** — 酒場合作 B2B toggle（選用模組），開啟後可輸入月售量，返利 20%
3. **營運設定** — 營業天數、時數、PT cover 比例 / 時薪 / 人數
4. **變動成本** — 每筆交易變動成本率 slider（0-30%），含可收合的參考區間
5. **每月固定成本** — 房租、水電、折舊、正職薪資；PT 排班 + 勞保自動計算

### 右側結果區塊

1. **BEP 結果卡**（`bep-glow`）— 大數字 + 目標月利潤輸入 + 公式說明 + Reset 按鈕
2. **銷量目標情境卡**（`result-card`）— 全霜淇淋 / 各半 / 全聖代 / 自訂，月日時銷量 + 對比表
3. **免責說明** — 提醒變動成本率需自行調整
4. **損益敏感度圖** — Chart.js 折線圖，綠色獲利 / 紅色虧損
5. **固定成本結構** — 水平長條圖，各項佔比

### 核心公式

```
目標營業額 = (固定成本 − 酒場貢獻 + 目標利潤) ÷ (毛利率 − 變動成本率)
```

- 目標利潤 = 0 時 → 就是 BEP（損益平衡）
- 酒場未開啟時 → 酒場貢獻 = 0
- 變動成本率 = 0 時 → 分母退化為毛利率

### JS 結構

- `checkPW()` — 密碼驗證（SHA-256）
- `calc()` — 主計算函式，所有輸入 `onchange` / `oninput` 都呼叫它
- `blendedGM()` — 計算混合毛利率（以營收加權）
- `setScenario()` — 切換產品組合情境
- `fmt()` / `fmtDec()` — 數字格式化

## Conventions

- **所有數字用 `.num` class**：`font-family: Inter; font-variant-numeric: tabular-nums`
- **色彩系統**：橘色 `#E8744F`（主色 / BEP）、綠色 `#059669`（目標利潤模式）、紫色 `#9333EA`（B2B 酒場）、藍色 `#3B82F6`（PT 相關）、玫瑰 `#F43F5E`（變動成本）
- **卡片樣式**：`.card`（基本白卡）、`.bep-glow`（BEP 結果，多層陰影）、`.result-card`（情境卡，立體陰影）
- **背景**：暖色工程圖紙風格（`#E8E0D3` + 格線）
- **密碼不以明文存在 source 中**，只存 SHA-256 hash
- **B2B 酒場通路是選用模組**，所有 B2B 相關的 UI 和計算都由 `b2b_enabled` toggle 控制，預設關閉
- **變動成本率只影響直營通路 BEP 分母**，不影響酒場貢獻計算

## Current Status

### Completed

- 基礎 BEP 計算（產品設定 × 營運設定 × 固定成本）
- 酒場 B2B 通路模擬（選用，toggle 開關，返利 20%）
- 損益敏感度折線圖（Chart.js，綠/紅漸層）
- 固定成本結構長條圖
- 多情境對比（全霜淇淋 / 各半 / 全聖代 / 自訂比例）
- 目標利潤模式（輸入目標月利潤 → 反推所需營業額，badge 橘→綠切換）
- 變動成本率 slider（0-30%，含可收合的參考區間）
- Reset 按鈕（卡片右上角，目標利潤 > 0 時出現）
- 密碼閘門（SHA-256）
- 所有數字 Inter 字體 + tabular-nums
- 結果卡片立體化（多層 shadow）

### Pending / Ideas

- 參數快照 / 情境對比（保守版 vs 樂觀版並排）
- 匯出為圖片 / PDF
- 敏感度圖加上「預估營業額」標記線
- 季節性模擬（淡旺季）

## Deployment

```bash
# 本地預覽 — 直接開瀏覽器
open index.html

# 部署 — push to main，Vercel 自動部署
git push origin main
```

## Common Pitfalls

- **BEP 公式分母不能為零**：如果 `毛利率 ≤ 變動成本率`，BEP 會變成 Infinity。程式碼有 `effectiveGM > 0` 的 guard，但要注意不要讓 slider 設到不合理的值
- **B2B 貢獻只抵固定成本，不影響變動成本計算**：酒場的毛利貢獻（扣完 20% rebate）直接從固定成本分子扣除，變動成本率只作用在直營 BEP 的分母
- **PT 勞保是固定 1,700 元 × 人數**：這是簡化計算，實際勞保級距會不同
- **密碼 hash 寫死在 JS 裡**：改密碼需要重新算 SHA-256 hash 並更新 `PW_HASH` 常數
- **Chart.js 的 borderColor 用 function 而非固定值**：因為要做綠紅漸層切換，如果改成固定色會失去效果
- **README.md 的注意事項還提到「外送平台抽成」**：已從頁面移除（因為沒有外送平台），但 README 尚未同步更新
