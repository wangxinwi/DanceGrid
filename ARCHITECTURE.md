# DanceGrid 架构设计与实施路线

## 1. 文档信息

- **产品名称**: DanceGrid
- **版本**: v0.1 → v0.2 架构升级
- **文档日期**: 2026-07-10
- **定稿原因**: 从纯前端 Mock 原型 → 本地优先 PWA（过渡阶段）→ 原生 App（最终形态）
- **关键决策**: 纯本地业务数据 + 静态托管分发 + 轻量 Cloudflare Worker 授权层
- **托管域名**: 已有一个 Cloudflare 托管的域名，无需 ICP 备案
- **参考文档**: `prd-v0.1.md`（产品需求）、`AGENTS.md`（开发规则）、`ARCHITECTURE.md`（本文）

---

## 2. 架构总览

### 2.1 核心架构决策

```
┌──────────────────────────────────────────────────────────────────┐
│                    DanceGrid 核心架构                             │
│                                                                  │
│  每个用户 = 每台手机                                              │
│  数据存在 = 手机本地                                              │
│  分发方式 = Cloudflare Pages 静态托管                             │
│  服务器只存 = HTML/CSS/JS 代码（纯静态文件）                      │
│  Worker 只管 = 邀请码、席位、授权状态                            │
│  Worker 不存 = 课程、工作室、对账等业务数据                      │
│                                                                  │
│  用户 A 的 iPhone  ←── 访问静态站点  ──→  服务器（只存前端代码）  │
│       │                                                          │
│       └── 数据存在 A 手机的 IndexedDB / SQLite 中                │
│                                                                  │
│  用户 B 的 iPhone  ←── 访问静态站点  ──→  同上服务器             │
│       │                                                          │
│       └── 数据存在 B 手机的 IndexedDB / SQLite 中                │
│       └── A 和数据完全不可见，物理隔离                           │
└──────────────────────────────────────────────────────────────────┘
```

**关键点**:

1. **每台手机就是"一个用户"** — 业务数据不做云端账户分离
2. **数据完全在本地** — IndexedDB（PWA 阶段）或原生 SQLite（App 阶段）
3. **内测分发由 Worker 负责** — 只校验邀请码和席位，不接触课程数据
4. **"用户隔离" = 手机物理隔离** — A 的手机看不到 B 的数据，反之亦然
5. **不使用 PIN 作为主方案** — 内测阶段用邀请码门禁，正式版改为 App Store 买断

### 2.2 数据流

```
用户操作 UI
     │
     ▼
React 组件调用本地数据层 API
     │
     ├── 读: db.courses.where(...).toArray()
     ├── 写: db.courses.add() / update() / delete()
     └── 计算: 对账逻辑、日详情等在内存中计算（不存计算结果）
               
               ▲          ▲
               │          │
        ┌──────┴──┐  ┌───┴──────┐
        │IndexedDB│  │ 计算函数 │
        │(浏览器) │  │(纯内存)  │
        └─────────┘  └──────────┘

数据层抽象（db.ts）:
  - PWA 阶段 → dexie.js（IndexedDB 封装）
  - App 阶段 → @capacitor/sqlite（原生 SQLite）
  - 两阶段 API 接口完全一致，UI 代码无需改动
```

**重要**: 计算逻辑（对账汇总、月视图统计、复制排班等）**全部在前端内存中完成**，不存计算结果到数据库。每次打开或数据变更时重新计算。数据量（一个老师每月几十节课程）决定了这种方式的性能完全足够。

### 2.3 内测授权流

```
用户首次打开 App
      │
      ▼
输入邀请码 / 激活码
      │
      ▼
Cloudflare Worker 校验邀请码与席位
      │
      ├── 通过 → 返回授权令牌（本地缓存）
      └── 拒绝 → 提示邀请码无效 / 席位已满 / 已失效

之后正常使用：
  - 业务数据仍然只保存在本地
  - 令牌只用于定期重新校验授权
  - Worker 不接触课程、工作室、对账数据
```

---

## 3. 当前代码状态

### 3.1 已有（v0.1 原型）

- ✅ 完整的 React 前端 UI（当前 `App.tsx` 约 3800 行，单文件）
- ✅ 所有业务逻辑：月视图、周视图、日视图、对账计算、复制排班等
- ✅ 6 种课程类型、工作室管理、模板管理
- ✅ 模拟数据（hardcoded 数组在 App.tsx 中）
- ✅ Vite 构建系统
- ✅ shadcn/ui 组件 + Tailwind CSS
- ✅ 适合接入 Cloudflare Worker 的轻量授权门禁方案

### 3.2 缺失（需要改造的）

- ❌ 数据持久层（刷新页面后数据全部丢失）
- ❌ 代码拆分（全部在 App.tsx 单文件中）
- ❌ PWA 配置（manifest + service worker）
- ❌ 邀请码门禁与席位校验
- ❌ 分发机制（如何让其他人安装使用）

---

## 4. 实施路线（三阶段）

### 阶段一：数据持久化（1-2 天）

**目标**：Mock 数据迁移到 IndexedDB，刷新页面数据不丢失

**改动**：

```
新增文件:
  src/lib/db.ts              ← dexie 实例 + 表定义

修改文件:
  src/App.tsx                ← 加载时从 IndexedDB 读，操作时同步写
  src/main.tsx               ← 加 <Suspense> 处理加载状态
```

```typescript
// src/lib/db.ts — 数据层代码（PWA 阶段）
import Dexie, { type Table } from "dexie";
import type { CourseRecord, StudioRecord, TemplatePreset } from "@/types";

class DanceGridDB extends Dexie {
  courses!: Table<CourseRecord>;
  studios!: Table<StudioRecord>;
  templates!: Table<TemplatePreset>;
  settings!: Table<{ key: string; value: string }>;

  constructor() {
    super("DanceGrid");
    this.version(1).stores({
      courses: "++id, date, studio, classStatus, paymentStatus",
      studios: "++id, name, archivedAt",
      templates: "++id, studioId, archivedAt",
      settings: "key",
    });
  }
}

export const db = new DanceGridDB();
```

**App.tsx 改造要点**：

1. 加 `useEffect(() => { loadFromIndexedDB() }, [])` 在 app 启动时加载
2. 所有 `handleCreate*`、`handleUpdate*`、`handleDelete*` 中异步同步写 IndexedDB
3. 数据完全加载后再渲染 UI（`dataLoaded` 状态控制）
4. 初始 mock 数据只作为首次启动的种子数据

**不做的**：
- ❌ 不做代码拆分（阶段三做）
- ❌ 不做计算逻辑改造（计算仍在内存中，逻辑不动）
- ❌ 不改 UI 组件

---

### 阶段二：PWA + 静态托管分发（半天）

**目标**：配置 PWA，部署到静态托管平台，iPhone 可安装使用

```bash
npm install vite-plugin-pwa
```

```typescript
// vite.config.ts — 增加 PWA 配置
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "DanceGrid",
        short_name: "DanceGrid",
        description: "街舞老师课表记录与课时费对账工具",
        theme_color: "#F3F5F7",
        background_color: "#F3F5F7",
        display: "standalone",
        start_url: "/",
        orientation: "portrait",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // 关键：不缓存 API 请求（没有 API）
        // 只缓存静态资源
      },
    }),
  ],
});
```

**PWA 关键行为**：

| 行为 | 说明 |
|------|------|
| 离线可用 | 首次加载后，后续开启即使断网也能完整使用 |
| 数据安全 | 所有数据在 IndexedDB，不离开手机 |
| 安装方式 | Safari → 分享 → 添加到主屏幕 |
| 外观 | 全屏无浏览器栏，看起来和原生 App 一样 |
| 更新 | 发布新版后，下次打开自动静默更新 |

**使用 Cloudflare 域名（核心优势）**：

Cloudflare 托管域名在本架构下可发挥三大作用：
1. **免费 HTTPS** — Cloudflare 自动签发 SSL 证书，无需任何配置
2. **CDN 加速** — PWA 静态文件从全球节点分发，国内访问更快
3. **免 ICP 备案** — Cloudflare 代理模式下，源站在海外无需备案

> **关键**：有了 Cloudflare 域名，你不需要 ICP 备案，也不需要华为云。全程在 Cloudflare 生态内完成。

**推荐方案：Cloudflare Pages + Cloudflare Worker（¥0/月，最贴合本项目）**

```
用户 iPhone → dancegrid.com
                   │
            Cloudflare DNS 解析
                   │ CNAME
            dancegrid.pages.dev
                   │
            Cloudflare Pages 托管前端
                   │
            invite.dancegrid.com → Cloudflare Worker
```

配置步骤（10 分钟）：

```bash
# 1. Cloudflare Pages 部署
#    GitHub 推送 → Cloudflare Pages 自动构建
#    获得 https://dancegrid.pages.dev

# 2. Cloudflare DNS 设置
#    Cloudflare 控制台 → DNS → 添加记录：
#    CNAME  @  →  dancegrid.pages.dev
#    CNAME  invite → <worker 子域或 worker 绑定>
#    代理状态: ✅ 开启（橙色云朵 = 通过 Cloudflare 代理）

# 3. 绑定自定义域名
#    Pages 项目 → Custom domains → 添加 dancegrid.com
#    Worker 服务 → 绑定 invite.dancegrid.com

# 4. 等待生效（几分钟到一小时）
#    curl https://dancegrid.com → 看到 DanceGrid 界面
```

**备选方案：Cloudflare + 华为云香港 ECS（¥50-100/月，国内速度更快）**

如果 Vercel 在国内访问太慢，可以用华为云香港节点（免备案）：

```
域名 dancegrid.com
         │
    Cloudflare DNS
         │ A 记录
    华为云香港 ECS 公网 IP
         │
    nginx 托管前端静态文件
```

**平台对比总表**：

| 方案 | 费用 | HTTPS | 备案 | 国内速度 | 操作复杂度 |
|------|------|-------|------|---------|-----------|
| **✅ Cloudflare Pages + Worker（首推）** | **¥0/月** | 自动 | ❌ 不用 | 中等 | ⭐ 极简单 |
| Cloudflare + 华为云香港 ECS | ¥50-100/月 | 自动 | ❌ 不用 | ✅ 很快 | ⭐⭐⭐ 中等 |
| 纯 Cloudflare Pages | ¥0/月 | 自动 | ❌ 不用 | 中等 | ⭐ 极简单 |
| 华为云大陆 ECS + 备案 | ¥50-100/月 | 需配 | ✅ 需 1-2 周 | ✅ 最快 | ⭐⭐⭐⭐ 复杂 |

**推荐**：直接走方案一 **Cloudflare Pages + Worker**，¥0、免备案、10 分钟上线。

---

### 阶段三：代码拆分 + 邀请码门禁（2-3 天）

**目标**：拆分单文件、加内测邀请码门禁、结构清晰可维护

```
src/
├── main.tsx                     # 入口，几乎不变
├── App.tsx                      # 简化到 ~300 行（路由 + 布局）
├── styles.css                   # 不变
│
├── types/
│   └── index.ts                 # 所有类型定义（从 App.tsx 抽出）
│     ├── CourseRecord
│     ├── StudioRecord
│     ├── TemplatePreset
│     ├── CourseType, CourseClassStatus, PaymentStatus
│     ├── WeekdayLabel, MonthKey
│     └── ...其他辅助类型
│
├── db/
│   ├── index.ts                 # dexie 实例 + 表定义
│   └── seed.ts                  # 首次启动的种子数据
│
├── hooks/
│   ├── useAuth.ts               # 邀请码状态 + 验证
│   ├── useCourses.ts            # 从 IndexedDB 加载 + CRUD
│   ├── useStudios.ts
│   ├── useTemplates.ts
│   ├── useMonthState.ts         # 现有逻辑（月视图计算）
│   └── useReconcileState.ts     # 现有逻辑（对账计算）
│
├── lib/
│   └── utils.ts                 # cn() 不变
│   ├── currency.ts              # formatCurrency() 等
│   ├── date.ts                  # pad(), formatDateKey(), isWeekend() 等
│   └── course.ts                # getCourseFee(), getRecordFeeValue() 等
│
├── components/
│   ├── ui/                      # 已存在的 shadcn 组件，不变
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── MobileFrame.tsx
│   │   ├── InviteGateScreen.tsx # 邀请码界面（新增）
│   │   └── BottomNav.tsx
│   ├── views/
│   │   ├── MonthView.tsx
│   │   ├── WeekView.tsx
│   │   ├── DayView.tsx
│   │   └── ReconcilePage.tsx
│   ├── dialogs/
│   │   ├── EditorSheet.tsx
│   │   ├── DetailSheet.tsx
│   │   ├── StudioDialog.tsx
│   │   ├── TemplateDialog.tsx
│   │   ├── CopyMonthDialog.tsx
│   │   └── DeleteConfirmDialog.tsx
│   └── shared/
│       ├── EventCard.tsx
│       ├── TimeRail.tsx
│       ├── EventBadge.tsx
│       └── SectionLabel.tsx
│
├── pages/
│   ├── HomePage.tsx             # 月/周/日视图容器
│   ├── ReconcileView.tsx        # 对账容器
│   └── MorePage.tsx             # 设置/工作室/模板容器
│
└── data/
    └── constants.ts             # weekdayLabels, courseTypeOptions 等
```

**拆分原则**：

| 原位置 | 拆到哪里 |
|--------|---------|
| Type 定义 | `types/index.ts` |
| Mock 数据 | 删除，改为 `db/seed.ts`（首次启动时写入 IndexedDB） |
| 工具函数 | `lib/*.ts` |
| 常量 | `data/constants.ts` |
| Hook 逻辑 | `hooks/*.ts` |
| UI 组件 | `components/*.tsx` |
| 页面容器 | `pages/*.tsx` |

**邀请码门禁实现**：

```tsx
// App.tsx 顶层
function App() {
  const [entitled, setEntitled] = useState(false);

  if (!entitled) {
    return <InviteGateScreen onPass={() => setEntitled(true)} />;
  }

  return <DanceGridApp />;
}
```

```tsx
// InviteGateScreen.tsx
// 第一次使用 → 输入邀请码
// Worker 校验通过后 → 保存本地授权令牌
// 后续打开 → 优先读取本地令牌，必要时再向 Worker 重新校验
```

---

## 5. 重要架构规则

### 5.1 数据层规则

```typescript
// 所有数据操作都通过 db.ts 暴露的 API
// UI 代码从不直接操作 IndexedDB

// ✅ 正确写法
import { db } from "@/db";
const records = await db.courses.where("date").between(a, b).toArray();

// ❌ 错误写法
// import Dexie from "dexie";
// const myDb = new Dexie("xxx");  // 不要在组件里创建新实例

// 数据层 API 在 PWA 和原生 App 阶段保持一致
// 切换底层时，只需修改 db/index.ts，其余代码不动
```

### 5.2 计算逻辑规则

```
所有统计/对账/汇总计算都在内存中进行：
  
  数据（IndexedDB）
       │
       ▼
  React hook（useMemo）← 依赖的数据变化时自动重算
       │
       ▼
  UI 渲染

不存计算结果的理由：
  - 数据量小（一个老师 ~20-50 节/月）
  - 计算逻辑简单（求和、过滤、分组）
  - 避免计算结果与源数据不一致
  - 复制排班等操作会生成新数据，直接写回 IndexedDB
```

### 5.3 用户隔离规则

```
每台手机 = 独立的用户实例

隔离方式：
  - 物理隔离：数据存在不同手机，互相不可见
  - 邀请码门禁：只有被授权的内测用户能首次进入应用

不实现的：
  - ❌ 用户注册 / 登录页面
  - ❌ 用户切换功能
  - ❌ 数据共享 / 协作

未来可能的扩展：
  - 换手机时：增加「导出 → 导入」功能（不用服务器）
  - 多设备同步：需要加后端服务器，不在 v0.x 范围内
```

### 5.4 代码变更规则

```
1. 任何新增文件都要在 ARCHITECTURE.md 中找到对应结构
2. 添加新功能时优先放在已有目录下
3. 修改数据层时，必须同时更新 PWA 和原生 App 两个实现
4. 修改计算逻辑时，只需改对应 hook，不影响 UI 和数据层
```

---

## 6. 数据模型

### 6.1 课程实例 (courses)

```typescript
interface CourseRecord {
  id: string;
  date: string;                // "2026-07-07"
  time: string;                // "18:00"
  end: string;                 // "19:30"
  title: string;
  studio: string;
  type: CourseType;            // "Regular" | "Substitute" | ...
  classStatus: CourseClassStatus;  // "待开" | "已开" | "停课" | "请假"
  paymentStatus: PaymentStatus;    // "未收" | "已收" | "部分已收" | "超时未收"
  fee: string;
  templateId?: string | null;
  contentTag: string;
  contentDescription: string;
  departureMinutes: string;
  musicNote: string;
  attachments: string;
  note: string;
  paymentTime: string;
  actualReceivableAmount: string;
  actualReceivedAmount: string;
  createdAt: string;
  updatedAt: string;
  weekend?: boolean;
}

// IndexedDB 索引（用于快速查询）
// date: 按日期筛选月份
// studio: 按工作室筛选
// classStatus: 按状态筛选
// paymentStatus: 按收款状态筛选
```

### 6.2 工作室 (studios)

```typescript
interface StudioRecord {
  id: string;
  name: string;
  displayTypes: CourseType[];
  baseFee: string;
  payDay: string;
  contact: string;
  note: string;
  weeklySessionCount: string;
  address?: string;
  feeUnit?: string;
  cancelCompensationRatio?: string;
  contactName?: string;
  contactMethod?: string;
  groupTag?: string;
  archivedAt?: string;  // 软删除标记
}
```

### 6.3 课程模板 (templates)

```typescript
interface TemplatePreset {
  key: string;
  title: string;
  detail: string;
  extra: string;
  status: "Live" | "Draft" | "Hold";
  studio: string;
  type: CourseType;
  contentTag: string;
  contentDescription: string;
  weekday: string;
  weekdays: string[];
  time: string;
  repeatUnit: "week" | "month";
  repeatEndMode: "count" | "date" | "month";
  repeatEndValue: string;
  fee: string;
  defaultDepartureMinutes: string;
  note: string;
  archivedAt?: string;
}
```

---

## 7. 部署流程

### 7.1 开发阶段

```bash
npm run dev       # 本地开发（Vite 热更新）
npm run build     # 构建到 dist/
npm run preview   # 本地预览构建结果
```

### 7.2 分发阶段

```
每次修改后：
  npm run build
  git commit + git push

Cloudflare Pages + Worker（主方案）：
  - Cloudflare Pages 自动从 GitHub 触发构建和部署
  - 获得 https://dancegrid.pages.dev（或自定义域名）
  - Worker 绑定 invite.dancegrid.com 负责内测授权
  - 通过 https://dancegrid.com 访问
```

### 7.3 更新机制

```
PWA 更新说明：
  - 服务器更新代码后，用户下次打开会自动下载新版
  - 静默更新，不打扰用户
  - 旧版 Service Worker 会缓存旧版，新版会在后台加载后替换
  - 当前正在使用的用户需下次打开才看见新版本

建议：
  - 非紧急更新：等待用户自然重新打开
  - 紧急更新：在 vite-plugin-pwa 配置 prompt 模式提醒用户
```

---

## 8. 后续演进

### 8.1 App Store 上架（未来）

```
方案：Capacitor 包装为原生 iOS App，改为买断制

步骤：
  npx cap init
  npm run build
  npx cap add ios
  npx cap sync
  → Xcode 打开 ios/ 目录，签名构建

需要：
  - Apple Developer 账号（¥688/年）
  - 数据层切换：dexie.js → @capacitor/sqlite
  - 接口不变，换底层实现即可
  - 加 Face ID / Touch ID 支持
  - 上架后取消内测邀请码门禁，改为 App Store 购买状态判断

App Store 审核注意事项：
  - 纯本地 App，无网络请求，审核通过率高
  - 需要提供隐私政策说明数据不上传
  - 买断价格与具体支付方式后定，不在当前阶段锁死
  - 上架后取消内测邀请码门禁，改为 App Store 购买状态判断
  - 公开版不再依赖 Cloudflare Worker 席位校验
  - 如果后续再做团队版，再另起独立授权服务
```

### 8.2 数据迁移 / 导出导入（未来）

```typescript
// 导出（换手机时用）
async function exportData(): Promise<string> {
  const data = {
    studios: await db.studios.toArray(),
    templates: await db.templates.toArray(),
    courses: await db.courses.toArray(),
    settings: await db.settings.toArray(),
  };
  const json = JSON.stringify(data);
  // 保存为文件或生成二维码
  return json;
}

// 导入
async function importData(json: string) {
  const data = JSON.parse(json);
  await db.studios.bulkAdd(data.studios);
  await db.templates.bulkAdd(data.templates);
  await db.courses.bulkAdd(data.courses);
  // ...覆盖当前数据库
}
```

### 8.3 添加后端服务器（多年后）

```
如果未来需要多设备同步 / 团队协作 / 数据统计平台：

1. 新增 Express 后端（Express + SQLite + JWT）
2. 当前数据层替换为 API 调用
3. 数据库模型加 user_id 字段
4. 前端几乎不用改（数据层做了抽象）
5. 但这是很远的未来，当前不需要

当前做好的储备：
  - IndexedDB 到原生 SQLite 的数据层抽象
  - 数据模型已预留 user_id 意识
  - 所有业务逻辑在前端，与存储无关
```

---

## 9. 常见问题

### 9.1 换手机怎么办？

当前：数据在新手机为空，重新录入。

未来：加「导出当前数据 → 导入到新手机」功能（纯本地，不经过服务器），见 8.2 节。

### 9.2 数据会丢吗？

- 手机不丢、不坏、不重置 → 数据一直在 IndexedDB 中
- 建议定期从浏览器开发者工具中导出 IndexedDB 数据备份
- App 阶段（Capacitor）数据在原生 SQLite 中，随 iCloud 备份

### 9.3 为什么不用后端？

| 理由 | 说明 |
|------|------|
| 数据量极小 | 每人每月 ~50 条课程记录 |
| 不需要共享 | 不同老师数据完全隔离 |
| 减少运维 | 零服务器、零备案、零成本 |
| 隐私安全 | 数据不出手机 |
| 离线可用 | 不需要网络也能使用全部功能 |

### 9.4 为什么要用 Cloudflare 域名？

```
域名 dancegrid.com 的角色：
  - 品牌的统一入口（用户记一个网址）
  - 免费 HTTPS（Cloudflare 自动签发 SSL 证书）
  - 免费的 CDN 加速
  - 免 ICP 备案（源站部署在 Cloudflare Pages）
  - 未来灵活切换后端平台（改 DNS 指向即可，无需改代码）

具体流程：
  1. Cloudflare DNS 托管你的域名
  2. 开发阶段 → CNAME 到 Cloudflare Pages 预览地址
  3. 正式阶段 → 绑定到 Cloudflare Pages 正式项目
  4. 整个过程用户只记得 dancegrid.com，底层平台随便换
```

### 9.5 一个 iPhone 上有多个老师用怎么办？

当前方案不解决这个问题。一台 iPhone 只有一份数据。

如果需要（例如夫妻共用一台 iPhone 管理各自课程）：
- ✅ 简单方案：加「切换档案」功能（邀请门禁通过后再选档案）
- ✅ 数据隔离：同一 IndexedDB，不同档案用不同表前缀或查询 key
- ❌ 不做的理由：P0 是单人单机，这种场景出现后再说

---

## 10. 实施检查清单

### 阶段一：数据持久化

- [ ] `npm install dexie`
- [ ] 创建 `src/lib/db.ts`（dexie 实例 + 3 个业务表 + 1 个设置表）
- [ ] 修改 `App.tsx`：加载时从 IndexedDB 读数据
- [ ] 修改所有 `handleCreate*`/`handleUpdate*`/`handleDelete*`：同步写 IndexedDB
- [ ] 验证：创建课程 → 刷新页面 → 数据还在

### 阶段二：PWA + 分发

- [ ] `npm install vite-plugin-pwa`
- [ ] `vite.config.ts` 增加 PWA 插件配置
- [ ] `npm run build` → 检查 dist/ 中生成 service worker
- [ ] 部署到 Cloudflare Pages
- [ ] iPhone Safari 打开 → 添加到主屏幕 → 全屏可用
- [ ] 验证离线功能

### 阶段三：代码拆分 + 邀请码门禁

- [ ] 创建 `types/index.ts`
- [ ] 创建 `data/constants.ts`
- [ ] 创建 `lib/currency.ts`、`lib/date.ts`、`lib/course.ts`
- [ ] 拆分 hooks
- [ ] 拆分 components
- [ ] 拆分 pages
- [ ] 加 `InviteGateScreen.tsx`
- [ ] 邀请码门禁：输入 → Worker 校验 → 本地缓存授权 → 解锁
- [ ] Cloudflare Worker 负责席位与邀请管理，不保存业务数据
- [ ] 后期买断制：公开版去掉邀请码门禁，改为 App Store 买断授权
- [ ] `App.tsx` 缩到 ~300 行

### 未来：Capacitor 原生 App

- [ ] `npm install @capacitor/core @capacitor/cli`
- [ ] `npx cap init`
- [ ] `npx cap add ios`
- [ ] 数据层切换：dexie.js → `@capacitor/sqlite`
- [ ] 加 Face ID
- [ ] Xcode 签名构建
- [ ] 提交 App Store（买断制）

---

## 11. 目录结构蓝图

```
DanceGrid/
├── prd-v0.1.md            # 产品需求（源文件）
├── AGENTS.md              # AI 开发规则
├── ARCHITECTURE.md        # 本文 - 架构设计
├── DESIGN.md              # 设计系统
├── PRD_UI_GAP_TODO.md     # PRD 差距清单
├── README.md
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
│
├── public/
│   ├── icon-192.png       # PWA 图标（待添加）
│   └── icon-512.png
│
├── src/
│   ├── main.tsx
│   ├── App.tsx            # 逐步拆小
│   ├── styles.css
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   ├── db/
│   │   ├── index.ts       # dexie 实例
│   │   └── seed.ts        # 种子数据
│   │
│   ├── lib/
│   │   ├── utils.ts       # cn()
│   │   ├── currency.ts
│   │   ├── date.ts
│   │   └── course.ts
│   │
│   ├── data/
│   │   └── constants.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCourses.ts
│   │   ├── useStudios.ts
│   │   ├── useTemplates.ts
│   │   ├── useMonthState.ts
│   │   └── useReconcileState.ts
│   │
│   ├── components/
│   │   ├── ui/             # shadcn 组件，不变
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   └── tabs.tsx
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── MobileFrame.tsx
│   │   │   ├── InviteGateScreen.tsx
│   │   │   └── BottomNav.tsx
│   │   ├── views/
│   │   │   ├── MonthView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   ├── DayView.tsx
│   │   │   └── ReconcilePage.tsx
│   │   ├── dialogs/
│   │   │   ├── EditorSheet.tsx
│   │   │   ├── DetailSheet.tsx
│   │   │   ├── StudioDialog.tsx
│   │   │   ├── TemplateDialog.tsx
│   │   │   ├── CopyMonthDialog.tsx
│   │   │   └── DeleteConfirmDialog.tsx
│   │   └── shared/
│   │       ├── EventCard.tsx
│   │       ├── TimeRail.tsx
│   │       ├── EventBadge.tsx
│   │       └── SectionLabel.tsx
│   │
│   └── pages/
│       ├── HomePage.tsx
│       ├── ReconcileView.tsx
│       └── MorePage.tsx
│
├── server/                # 阶段四才需要（如果需要后端）
│   └── ... (Express + SQLite + JWT)
│
└── ios/                   # Capacitor 生成，不上 Git
    └── ...
```

---

## 12. 关键资源

- `prd-v0.1.md` — 产品需求文档（业务规则和功能定义）
- `AGENTS.md` — AI 开发规则（开发约束和规范）
- `DESIGN.md` — 设计系统和视觉规范
- `ARCHITECTURE.md` — 本文（架构和实施路线）
- `PRD_UI_GAP_TODO.md` — 当前 PRD 与实现的差距清单
