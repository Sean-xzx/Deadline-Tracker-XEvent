[English](README.md) · 简体中文

# Deadline Tracker - XEvent

**把重要事项的截止时间、行动计划、进度和下一次跟进连在一起的 Windows 桌面工作台。**

## 项目价值

申请、项目和生活中的重要安排，往往需要持续推进：仅记录截止日期，还不足以说明计划、已有进展和下一步行动。XEvent 将这些信息集中在同一事项中，让使用者看清 **哪些事需要关注、推进到哪里、接下来做什么**。

项目面向个人学业、工作和生活规划，支持独立的截止／跟进时间、目标、策略、阶段进度及 Markdown 记录。卡片、列表、状态看板和截止时间线从不同角度呈现同一批事项。数据保存在本地，日常使用无需账号或联网；目前为单人应用，没有云同步和协作服务。

## 我的贡献 — Sean-xzx

我发起并主导这个个人项目，采用 **AI 辅助完成实现、测试与仓库整理**。我的主要贡献是：

- **需求定义与产品取舍：** 明确学业／工作／生活混合使用的场景，提出将截止时间与跟进、进度、下一步行动结合的需求。
- **界面评审与迭代：** 根据实际运行界面，指出侧栏未铺满、鼓励性文案过多等问题，推动调整信息层次和视觉风格。
- **工程交付推进：** 推动项目形成可运行的 Windows EXE、可恢复的本地数据、双语文档及从干净仓库副本验证的流程。

这些工作体现需求分析、界面评估和交付判断能力。下文代码与验证记录展示最终实现，不声称全部组件由我独立手写完成。

## 技术与设计方法

- **区分截止与跟进。** 没有截止日期的事项也可以安排跟进。共用规则按逾期、待跟进、临近截止排序；持久化通知键避免同一触发条件反复提醒。见[领域规则](app/domain.cjs)。
- **跨运行边界复用规则。** 界面和 Electron 主进程复用校验／进度逻辑，通过受限 preload API 执行桌面操作；Markdown 经 Marked 解析、DOMPurify 清理。浏览器预览使用独立的 localStorage 适配器。见[架构与文件地图](docs/architecture.md)。
- **让本地数据可恢复。** 保存先写临时文件再重命名，最多保留 14 份备份；导入先校验，再按编号和较新的更新时间合并，保留本地偏好。完成／重新开始、回收／恢复保留事项记录。见[存储实现](app/store.cjs)。

这些是面向产品需求的工程设计，不声称提出了新算法或研究结论。

## 成果证据

| 证据 | 能说明什么 |
| --- | --- |
| 下方真实 Electron 截图 | 桌面界面实际呈现内置虚构事项 |
| **15 项自动测试通过** | 领域规则、持久化、备份与 IPC 处理；主进程测试中的系统 API 使用模拟 |
| **真实桌面冒烟验证通过** | 界面、preload、IPC 与磁盘保存协同工作，覆盖新增／修改／回收／恢复、无效日期拒绝及页面重载 |
| **从干净远程副本成功构建 Windows x64 可移植版** | 文档中的依赖／构建流程生成 `release/XEvent-1.0.2.exe` |

已验证的源码提交 `98929fd` 也有[成功的 Windows CI 记录](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/actions/runs/37738822673)。[验证说明](docs/validation.md) 区分自动证据与手工检查。

![真实 Electron 桌面窗口与虚构示例事项](docs/images/overview.png)

六条示例包含五条未完成事项和一条已完成事项；日期、编号与时间戳随运行变化。这些证据属于功能／构建验证，没有用户研究或效率提升测量。原生通知送达、实际开机启动和托盘交互仍需手工验证。

## 运行与验证

应用版本 **1.0.2**，数据格式 **1**，界面为简体中文。已验证环境：**Windows 11 Home x64（构建 26200）、Node.js 22.23.2、npm 10.9.8、Electron 44.5.1**。依赖要求 Node >=22.12.0，其他开发 Node 版本未验证。

安装需要 Git，并能访问 npm、Electron 和打包工具下载地址；无需项目私人凭据、外部数据集、模型或付费服务。依赖／构建产物占用数百 MB，全新构建可能需要数分钟；EXE 使用者无需 Node.js。以下记录经所有者授权的使用方法，不构成授权，详见[权利声明](RIGHTS.md)。

在 PowerShell 中执行：

```powershell
git clone https://github.com/Sean-xzx/Deadline-Tracker-XEvent.git
cd Deadline-Tracker-XEvent
npm ci
node node_modules/electron/install.js
npm test
npm start
```

**成功标准：** 15 项测试通过，打开标题为 `XEvent · 重大事项` 的窗口。新桌面数据目录初始为空，已有数据会保留。点击 `载入示例` 后，总览显示五条事项，`已完成` 中有一条。最小编辑示例：新建事项，分别设置截止／跟进时间，添加两个阶段并完成其中一个，进度应为 **50%**。

浏览器预览：先运行 `npm run build:ui`，再运行 `npm run preview`，打开 [localhost:4173](http://127.0.0.1:4173)。新浏览器存储自动加载示例，Ctrl+C 停止服务。浏览器数据独立，不提供 Windows 通知、托盘及开机启动。

完成安装后，检查资源并构建可移植 EXE：

```powershell
npm run build:ui
npm run icons
node scripts/check-repository.cjs
npx --no-install electron scripts/smoke-desktop.cjs
npm run dist
```

**成功标准：** 仓库检查通过，冒烟报告包含 `"passed":true`，并生成 `release/XEvent-1.0.2.exe`，双击即可打开。冒烟使用隔离的临时数据目录，报告／截图写入 `artifacts/desktop-smoke/`。[GitHub Actions](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/actions) 在推送和 Pull Request 时运行这些检查。

## 数据、实现与限制

无需 `.env`。设置中可调整主题、提醒、托盘驻留和打包 EXE 的开机启动。默认浅色主题、开启通知及托盘驻留、不开机启动、每日 09:00 汇总、截止前提前三天提醒。桌面数据位于 `%APPDATA%/XEvent/events.json`，可从设置打开实际目录或导出／导入备份；导出包含已完成和回收站事项，**没有加密**。`XEVENT_DATA_DIR` 可指定隔离测试目录，同时跳过打包版 Windows 快捷方式注册；启动前设置，结束后移除。

入口为 `app/main.cjs`。界面源码 `src/renderer.js` 调用 `app/preload.cjs`；主进程通过 `app/domain.cjs` 校验请求、通过 `app/store.cjs` 保存，再向界面广播快照。`build:ui` 生成界面 bundle；`app/styles.css` 与 `app/design.css` 均须保留。依赖目录、构建产物、私人数据、缓存与备份不纳入 Git。

- **系统集成：** 提醒需要程序运行，关机、休眠和 Windows 通知设置会影响送达。关闭托盘驻留可能留下托盘但窗口已销毁，导致无法重新打开；建议保留默认值，并从托盘菜单完整退出。移动打包 EXE 后，需关闭再开启开机启动以更新路径。
- **兼容与分发：** Windows 10、macOS/Linux、其他架构、其他 Node 版本和 SmartScreen 未验证。构建未签名，没有自动更新。
- **依赖：** 2026-10-08 审计报告 electron-builder 依赖链经 `sprintf-js` 存在 8 项中等风险告警，无高危／严重项；保留原锁文件。下载失败时检查网络／代理，不保证离线全新安装。

延伸阅读：[架构与各文件职责](docs/architecture.md)、[验证命令与手工检查](docs/validation.md)、[中文使用说明](使用说明.md)。这是个人项目，没有维护 SLA 或固定发布计划。通过 [Issues](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/issues) 报告问题时，请提供版本、复现步骤和虚构数据，不上传私人记录或凭据；代码贡献及功能修改须事先取得书面许可。

## 权利与资源来源

Copyright (c) 2026 Sean-xzx。**保留所有权利，不提供开源许可证。** 公开可见允许按 GitHub 条款查看；运行、构建、修改、复用或再分发项目自有内容须事先取得书面许可，适用法律或平台条款另有规定的除外。详见双语[权利声明](RIGHTS.md)。

项目自制 SVG 用于生成 PNG／ICO 图标，截图使用项目生成的虚构示例。Electron、electron-builder、esbuild、sharp、Lucide（含 Feather 衍生图标）、Marked 和 DOMPurify 的第三方条款独立适用，实际文本及来源保留在 [THIRD_PARTY_NOTICES](app/THIRD_PARTY_NOTICES.txt)。DOMPurify 采用 Apache-2.0 选项，Electron 分发包含 Chromium 声明；这些条款不授权使用项目自有内容。
