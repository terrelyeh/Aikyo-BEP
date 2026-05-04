# CLAUDE.md — Project Context

> Last updated: 2026-05-04（CMS 擴充至營運 / 固定成本預設值）

## Project Overview

愛嬌冰店（Aikyo）的**互動式損益平衡分析工具**。單頁 HTML + 一個 Vercel serverless function，讓經營團隊掌握固定成本結構、找到損益平衡點（BEP），並以此為 baseline 規劃盈利策略。部署在 Vercel（https://aikyo-bep.vercel.app），有密碼閘門保護。功能清單與產品定位詳見 [README.md](README.md)。

## Tech Stack

- **單頁 HTML**（`index.html`）+ 一個 Vercel serverless function（`api/save-items.js`）
- Tailwind CSS 3（CDN）
- Chart.js 4.4（CDN）
- 字型：Noto Sans TC（中文）/ Inter（數字，tabular-nums）
- 部署：Vercel（push to main 自動部署，aikyo-bep.vercel.app）
- 密碼閘門：SHA-256 hash 比對，sessionStorage 保持登入
- 設定資料（CMS）：`config.json` 存於 repo（含 `items` + `defaults.operations` + `defaults.fixedCosts`）。前端 fetch 後渲染品項 + 套用預設值；編輯時透過 `/api/save-config` 用 GitHub API commit 回 main

## Directory Structure

```
.
├── index.html         # 主應用，包含 HTML + CSS + JS
├── config.json        # CMS 資料：品項 + 營運/固定成本預設值
├── favicon.svg        # 橘底圓形 + 白色「愛」字
├── api/
│   └── save-config.js # Vercel serverless function，驗證密碼後 commit config.json
├── README.md         # 專案說明（對外）
├── CLAUDE.md         # AI session context（本檔）
└── .claude/          # Claude Code 設定
```

沒有 `package.json`、沒有 build pipeline、沒有 node_modules。前端邏輯都在 `index.html`，serverless function 用 CommonJS 寫一個檔案搞定。

### Vercel 環境變數（必設）

| 變數 | 說明 |
|---|---|
| `GITHUB_TOKEN` | Fine-grained PAT，限本 repo `Contents: Read & Write` |
| `GITHUB_REPO`  | `terrelyeh/Aikyo-BEP` |

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

1. **產品設定** — 動態 N 品項（1–5 個，從 `config.json` 載入），每項可調售價 + 毛利率 slider；右上角 `✏️ 編輯品項` → modal 增刪改名 + 寫回 GitHub
2. **通路設定** — 酒場合作 B2B toggle（選用模組），開啟後 per item 月售量輸入，返利 20%
3. **營運設定** — 營業天數、時數、當月總時數（顯示）、PT cover 比例 / 時薪 / 人數；右上角 `💾 存為預設值` 寫回 `config.json`
4. **變動成本** — 每筆交易變動成本率 slider（0-30%），含可收合的參考區間
5. **每月固定成本** — 房租、水電、折舊（toggle，可關閉）、正職薪資；PT 排班 + 勞保自動計算；右上角 `💾 存為預設值` 寫回 `config.json`

### 右側結果區塊

1. **BEP 結果卡**（`bep-glow`）— 大數字 + 目標月利潤輸入 + 公式說明 + Reset 按鈕
2. **銷量目標情境卡**（`result-card`）— 動態：每品項一顆「全 X」 + 「平均混合」 + 「自訂」，月日時銷量 + 對比表
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

- `checkPW()` — 密碼驗證（SHA-256），通過後把原始密碼存 `sessionStorage.aikyo_pw` 以供 API 認證
- `bootstrap()` — fetch `config.json` → `applyDefaults()` 把 `defaults.operations` / `defaults.fixedCosts` 套到 input value → 渲染所有動態區塊 → `calc()`
- `calc()` — 主計算函式，所有輸入 `onchange` / `oninput` 都呼叫它，內部用 `items` 陣列
- `renderItems` / `renderB2BQty` / `renderScenarioButtons` / `renderCustomMix` — 依 `items` 重渲染對應區塊
- `setScenario(key)` — `'item_<i>' | 'avg' | 'custom'`
- `readCurrentConfig()` — 從目前所有 inputs 組出完整 config 物件
- `saveConfig(config)` — 共用：POST 到 `/api/save-config`，回傳 server 清洗後的 config
- `openItemsModal()` / `saveItemsToGitHub()` — 品項編輯 modal，按 save 時呼叫 `saveConfig`
- `saveDefaults(kind)` — 「存為預設值」按鈕用，把目前 inputs 整包寫回（`kind` 只決定 button 視覺狀態，server 永遠收整份 config）

## Conventions

- **所有數字用 `.num` class**：`font-family: Inter; font-variant-numeric: tabular-nums`
- **色彩系統**：橘色 `#E8744F`（主色 / BEP）、綠色 `#059669`（目標利潤模式）、紫色 `#9333EA`（B2B 酒場）、藍色 `#3B82F6`（PT 相關）、玫瑰 `#F43F5E`（變動成本）
- **卡片樣式**：`.card`（基本白卡）、`.bep-glow`（BEP 結果，多層陰影）、`.result-card`（情境卡，立體陰影）
- **背景**：暖色工程圖紙風格（`#E8E0D3` + 格線）
- **密碼不以明文存在 source 中**，只存 SHA-256 hash
- **B2B 酒場通路是選用模組**，所有 B2B 相關的 UI 和計算都由 `b2b_enabled` toggle 控制，預設關閉
- **變動成本率只影響直營通路 BEP 分母**，不影響酒場貢獻計算

## Current Status

功能清單詳見 [README.md](README.md)。

### 🔜 Next Steps

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
- **密碼 hash 寫死在 JS 裡**：改密碼需要重新算 SHA-256 hash 並**同時更新兩處** — `index.html` 的 `PW_HASH` + `api/save-config.js` 的 `PW_HASH`，否則 CMS 寫回會 401
- **CMS 認證流程**：login 時把原始密碼存 `sessionStorage.aikyo_pw`，存檔時 POST 給 serverless function；function 用 GitHub PAT (`GITHUB_TOKEN` env) 寫 `config.json` 回 main，會觸發 Vercel 自動部署 → 頁面下次 reload 才會看到新值
- **CMS 寫回永遠是整份 config**：所有 save 動作（品項 / 營運預設 / 固定成本預設）都送整份 `config.json` 到 `/api/save-config`，server 不做 partial merge — 前端 `readCurrentConfig()` 必須涵蓋所有目前狀態，否則會清掉沒讀到的欄位
- **舊 session 無密碼**：CMS 上線前的 session 沒存 `aikyo_pw`，bootstrap 會自動清掉 `aikyo_auth` 強制重新登入，避免存檔時 401
- **Chart.js 的 borderColor 用 function 而非固定值**：因為要做綠紅漸層切換，如果改成固定色會失去效果
