# 拾光日程

轻量的个人日程管理 Web 应用：月视图、周视图、待办清单与到点提醒，内置长期目标与游戏化成长体系（经验、等级、BOSS 挑战）。数据保存在浏览器本地（localStorage），无需注册、打开即用，支持安装为 PWA 应用。

## 功能

- **月视图**：整月日历网格，日程以彩色标签展示，点击日期快速新建，点击标签直接编辑
- **周视图**：7 天时间网格（6:00–24:00），按时间段定位日程块，当前时间有紫色时间线指示
- **待办清单**：按日期分组的待办列表，支持勾选完成、过期标记、已完成折叠；顶部输入框回车即可快速加入今日待办
- **任务拆解**：困难任务可拆成若干子任务，在待办清单里展开逐个勾选；含 2 个以上子任务的任务自动成为「BOSS」，显示血量条
- **打怪升级**：完成任务 +10 XP、完成子任务 +5 XP、击败 BOSS 额外 +20 XP；取消完成会对应扣回。累计经验提升等级（见习行者 → 拾光传说），记录连续打卡天数
- **长期目标**：在「目标与成长」页立下目标并设截止日期，日程可关联到目标，目标卡片自动汇总关联日程的完成进度
- **分类体系**：工作 / 生活 / 学习 / 健康 / 其他，五色分类，侧边栏可按分类筛选显示
- **到点提醒**：支持准时、提前 15 分钟、1 小时、1 天提醒，通过浏览器通知 + 应用内 Toast 触达
- **PWA**：可安装到桌面 / 手机主屏幕，离线可用

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui（Radix UI）
- date-fns 日期处理，lucide-react 图标，sonner 通知
- vite-plugin-pwa（Service Worker + Web App Manifest）

## 本地开发

```bash
npm install
npm run dev      # 开发服务器 http://localhost:3000
npm run build    # 生产构建到 dist/
npm run preview  # 预览构建产物
```

## 数据说明

所有数据存储在浏览器 `localStorage`（键：`shiguang.events.v1` / `shiguang.goals.v1` / `shiguang.xp.v1` / `shiguang.filters.v1`），不上传任何服务器。清除浏览器数据会删除日程与成长记录。首次打开会写入几条示例日程（含一个 BOSS 拆解示例），可直接删除。

## 目录结构

```
src/
├── components/        通用组件（EventDialog 日程编辑弹窗、ui/ shadcn 组件库）
├── hooks/             自定义 Hooks
├── lib/               store.tsx（状态 + 持久化）、game-utils.ts（经验/等级/BOSS）、schedule-utils.ts（日期/分类）
├── pages/             Home 页面骨架（工具栏、移动端导航、提醒引擎、经验到账提示）
├── sections/          Sidebar / MonthView / WeekView / AgendaView / GrowthView 五大视图
└── types/             TypeScript 类型定义
```

## License

[MIT](./LICENSE)
