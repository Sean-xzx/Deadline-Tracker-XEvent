# Validation / 验证

Preparation date: 2026-10-08. This record separates executable evidence from manual OS integration checks. See the actual [CI runs](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/actions) for remote results.

整理日期：2026-10-08。以下区分实际执行证据和系统集成手工检查；远程状态以[具体 CI 运行](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/actions)为准。

## Commands and success criteria / 命令与成功标准

Start from a fresh clone with no `node_modules`, generated bundle, browser data or private configuration. Use PowerShell and Node 22.23.2:

从全新克隆开始，不预置依赖、界面 bundle、浏览器数据或私人配置。使用 PowerShell 与 Node 22.23.2：

```powershell
npm ci
node node_modules/electron/install.js
npm test
npm run build:ui
npm run icons
node scripts/check-repository.cjs
npx --no-install electron scripts/smoke-desktop.cjs
npm run dist
```

| Check / 检查 | Expected / 预期 | Evidence scope / 证据范围 |
| --- | --- | --- |
| `npm ci` | Exit 0; installed versions follow lockfile / 退出 0，版本符合锁文件 | Fresh dependency installation requires network / 全新安装需要网络 |
| `npm test` | 15 pass, 0 fail / 15 通过，0 失败 | Real domain/storage and real main handler code; OS API mocks / 实际领域、存储和主进程处理代码，系统 API 模拟 |
| `build:ui`, `icons` | Nonempty bundle, copied SVG, PNG and ICO / 非空 bundle、SVG、PNG、ICO | Generated resources used by runtime / 运行所需生成资源 |
| Repository checker | Success message, exit 0 / 成功信息，退出 0 | Local links/files and lock consistency, not all remote HTTP links / 本地路径和锁文件一致性，不替代所有远程链接检查 |
| Desktop smoke | `passed:true`, report and screenshot / 成功报告和截图 | Real Electron, preload bridge, IPC, persistence and page reload / 真实桌面、桥接、IPC、保存与页面重载 |
| Portable packaging | `release/XEvent-1.0.2.exe`, exit 0 / 生成 EXE，退出 0 | Unsigned Windows x64 build; not a signing/OS notification test / 未签名 Windows x64 构建，不代表签名或系统通知验证 |

The smoke creates a new directory prefixed `xevent-smoke-` in the OS temporary directory. It disables test-profile notifications, loads six fictional examples, captures the real window, exercises create/update/trash/restore and invalid-date rejection, verifies JSON on disk, then reloads the renderer and checks persisted values. It quits its own instance. Its report and screenshot go to `artifacts/desktop-smoke/` (ignored). A temporary Electron profile may remain in the OS temp directory after exit; it contains only synthetic test data.

冒烟在系统临时目录创建 `xevent-smoke-` 开头的新目录，关闭测试目录通知，载入六条虚构示例、截取真实窗口，再验证新增／修改／回收／恢复、无效日期拒绝、磁盘 JSON 和界面重载后的值，最后退出自身实例。报告与截图位于已忽略的 `artifacts/desktop-smoke/`。退出后临时 Electron 数据目录可能保留，仅含虚构测试数据。

The invalid-date error printed during smoke/tests is expected: rejection is asserted, and the process still must exit 0. Existing tests use a fixed local timestamp; sample UI dates and IDs are intentionally relative/random, not golden byte-for-byte outputs.

冒烟和单元测试中打印的无效日期错误属于预期拒绝，仍须以退出码 0 为成功。已有测试使用固定本地时间；界面示例日期和编号刻意随时间／随机编号变化，不要求逐字节一致。

## Evidence gathered / 已收集的证据

- Baseline before repository preparation: 15/15 existing tests passed on Windows 11 Home x64 (10.0.26200), Node 22.23.2 and npm 10.9.8.
- Real desktop smoke: passed with Electron 44.5.1 (embedded Node 24.21.0), using isolated synthetic data. The committed screenshot is captured by that run.
- Fresh local snapshot: npm installation with an empty npm cache succeeded; all 15 tests, UI/icon builds and repository checks passed. Electron 44 downloads its runtime on demand, so the documented explicit install step materializes it before execution or packaging.
- Dependency audit: eight moderate findings in the electron-builder chain via `sprintf-js`; no high/critical findings in the 2026-10-08 audit. Dependencies were preserved, not automatically upgraded.
- Core source preservation: SHA-256 comparison against the private pre-edit snapshot protects the original desktop, renderer, domain, storage, markup, styles, build scripts and existing tests. Private snapshot paths/manifests are deliberately not published.
- Clean local packaging: `npm run dist` exited 0 with a 100,097,154-byte Windows x64 portable EXE. Packaging tools were downloaded into a new builder cache. Core modules and the UI bundle in `app.asar` matched the clean source; third-party and Chromium notices were present.
- The owner selected all rights reserved, with no open-source license. Setup/build instructions do not authorize use or functional modifications. The public repository's owner, visibility and push permission were verified; the remote CI run and final delivery record identify the published commit and its verification results.

- 整理前基线：Windows 11 Home x64（10.0.26200）、Node 22.23.2、npm 10.9.8，已有 15 项测试全部通过。
- 真实桌面冒烟：Electron 44.5.1（内嵌 Node 24.21.0）使用隔离虚构数据通过；公开截图由该次运行捕获。
- 全新本地快照：空 npm 缓存安装成功，15 项测试、界面／图标构建和仓库检查通过。Electron 44 按需下载运行时，文档明确的安装步骤会在运行或打包前准备它。
- 依赖审计：electron-builder 依赖链经 `sprintf-js` 存在 8 项中等风险告警；2026-10-08 审计无高危／严重项。保留原依赖，没有自动升级。
- 核心源码保护：与私有修改前快照进行 SHA-256 比较，保护原桌面、界面、领域、存储、页面、样式、构建脚本及原测试。私有备份路径与清单不公开。
- 全新本地打包：`npm run dist` 退出 0，生成 100,097,154 字节的 Windows x64 可移植 EXE；打包工具下载到全新缓存。`app.asar` 中核心模块及界面 bundle 与干净源码一致，第三方和 Chromium 声明完整。
- 所有者已选择保留所有权利、不提供开源许可证；安装与构建说明不授权使用或功能修改。已核实公开仓库所有者、可见性与推送权限，远程 CI 和最终交付记录指明发布提交及其验证结果。

## Still manual or unverified / 仍需手工检查或未验证

- Native Windows notification visibility/click delivery under different OS notification settings.
- Actual login startup after logging out/in, and behavior after moving the portable EXE.
- Tray clicks and lifecycle when `closeToTray` is false; the source-level destroyed-window limitation is documented in both READMEs.
- Windows 10, Linux/macOS, ARM/x86, other development Node versions, SmartScreen, code signing and auto-update.
- Exhaustive accessibility, high-DPI/multi-monitor behavior and all UI interactions. A screenshot and smoke test do not establish these.

- 不同系统通知设置下的 Windows 通知显示与点击送达。
- 注销／登录后的实际开机启动，以及移动 EXE 后的行为。
- 托盘点击及关闭托盘驻留后的生命周期；双语 README 已记录窗口销毁限制。
- Windows 10、Linux/macOS、ARM/x86、其他开发 Node 版本、SmartScreen、签名与自动更新。
- 全面无障碍、高 DPI、多屏及所有界面交互；截图和冒烟不能证明这些项目。

For manual validation use an isolated `XEVENT_DATA_DIR` where possible. Do not use real personal backups in public CI, screenshots or bug reports. A normal packaged run (without that override) is needed to test Windows shortcut registration and OS integration; back up your own data before such checks.

手工验证尽量使用隔离的 `XEVENT_DATA_DIR`。公开 CI、截图或问题报告不使用真实备份。Windows 快捷方式注册与系统集成需在不设置覆盖目录的普通打包版中验证，检查前请备份自己的数据。
