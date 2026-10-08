[简体中文](README.zh-CN.md) · English

# Deadline Tracker - XEvent

A local Windows desktop workspace for important matters, deadlines, plans and follow-up notes.

XEvent is a personal project for keeping study, work and life commitments together. The interface is currently in Simplified Chinese. Application version: **1.0.2**; JSON data format version: **1**.

![Real Electron desktop with synthetic example matters](docs/images/overview.png)

This screenshot comes from the real Electron application running the built-in synthetic examples. Dates are relative to the day examples are loaded; UUIDs and timestamps change between runs.

## Features and scope

- Separate deadline and follow-up time; priorities, starred matters, goals, strategy and next actions.
- Checklist stages with progress; editable Markdown follow-up notes and HTTP/HTTPS resource links.
- Cards, list, status board with drag and drop, and deadline timeline; categories, search and sorting.
- Completion/reopening, recoverable trash, light/dark/system theme and keyboard shortcuts.
- Local JSON storage, automatic backups and manual export/import with merge by ID and newer update time.
- Windows notifications for follow-up, approaching deadlines, overdue matters and daily summaries; snooze and tray residency; optional login startup in the packaged EXE.

This is a single-user desktop application. It has no cloud synchronization, collaboration service, accounts or server database. Once installed/built, managing local matters needs no network connection. Opening an external resource link can use the network.

## Requirements

- **Verified locally:** Windows 11 Home x64, build 26200; Node.js **22.23.2**, npm **10.9.8**, Electron **44.5.1**. Electron's embedded Node is separate from the development Node version.
- For development, use Node.js **22.23.2** with npm; dependencies require Node >=22.12.0. Other Node versions and Windows 10 have not been verified here. Linux/macOS desktop operation and packaging are unverified.
- Git and network access to npm, Electron downloads and packaging tools are needed for a fresh install/build. No project API key, paid service, model, external dataset or signing certificate is required.
- Use Windows x64 for the documented portable build. The EXE user does not need Node.js. Dependencies/build output occupy hundreds of MB; a fresh package build can take several minutes.

## Quick start

Run the following in PowerShell:

```powershell
git clone https://github.com/Sean-xzx/Deadline-Tracker-XEvent.git
cd Deadline-Tracker-XEvent
node --version
npm ci
node node_modules/electron/install.js
npm test
npm start
```

Expected: 15 tests pass, then a window titled `XEvent · 重大事项` opens. A new data profile starts empty. Click `新建事项` to create a matter, or `载入示例` to load six synthetic examples. An existing local profile retains its own contents.

For a separate browser preview:

```powershell
npm run build:ui
npm run preview
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). A fresh browser profile automatically contains the six examples. Stop the preview with Ctrl+C. This preview has its own localStorage data and does not provide Windows notifications, tray integration or login startup; it is not a substitute for desktop validation.

## Representative workflow

1. In an empty desktop profile, choose `载入示例`: expect **six stored matters**, **five unfinished** on the overview, and **one completed** under `已完成`.
2. Create `Submit application`, category `学业`, with a deadline and a separate follow-up time. Set the next action to `Review the materials` and add two checklist stages, one marked `[x]`. Expect **50%** stage progress.
3. Add a Markdown note, edit it, and switch between cards/list/board/timeline. Marking the matter complete moves it to `已完成`; `重新开始` makes it active again.
4. Move a matter to `回收站`, then restore it. Its notes and stages remain. In settings, export JSON; importing it again merges by ID rather than creating duplicates. Current preferences are preserved.
5. Exit using the tray menu, restart, and confirm the data remains. To check actual OS delivery, enable notifications and use `发送测试通知` in settings. Windows notification/Do Not Disturb settings affect delivery.

Shortcuts: Ctrl+N creates a matter; Ctrl+K searches; Ctrl+Enter saves the active editor/note; Esc closes a dialog. The automated example below uses an isolated temporary profile and does not edit your normal data.

## Configuration and resources

No `.env` file is required. Preferences are edited in the UI and saved with the data. Defaults are light theme, notifications enabled, close to tray enabled, login startup disabled, daily summary at 09:00 and three days' deadline lead time.

- Normal desktop data: `%APPDATA%/XEvent/events.json`; backups: the adjacent `backups/` directory. Use settings to open the actual data directory.
- `XEVENT_DATA_DIR` overrides the data directory for isolated development/testing and skips packaged Windows shortcut registration. Set it before launching; remove it afterwards. For example:

  ```powershell
  $env:XEVENT_DATA_DIR = Join-Path $env:TEMP 'xevent-dev-profile'
  npm start
  Remove-Item Env:XEVENT_DATA_DIR
  ```

- Browser keys: `xevent-browser-preview-v1` (data), `xevent-ui-v1` (view selection). Browser and desktop data are independent.
- Existing files are backed up on the first applicable save per Store instance/UTC day and before imports; the newest **14** backups are kept. Saves write a temporary JSON file then rename it. JSON exports include completed and trashed matters and are **not encrypted**.
- Imports accept format version 1, at most 10,000 matters and a 20 MB file; malformed dates and duplicate IDs are rejected. Invalid startup data is left intact and reported rather than overwritten.
- Examples are generated by `sampleEvents()`; all examples and screenshots are synthetic. There are no extra datasets or models to download. UUIDs, dates, compression and environment differences mean EXE hashes/screenshots are not promised to be identical across builds.

## Structure and architecture

| Path | Responsibility |
| --- | --- |
| `src/renderer.js` | UI source, editing, filtering, views; browser-preview adapter |
| `app/main.cjs` | Desktop entry: window, IPC, notifications, tray, import/export and login integration |
| `app/preload.cjs` | Restricted API exposed as `window.xevent` |
| `app/domain.cjs` | Shared validation, progress, sorting, reminder rules and examples |
| `app/store.cjs` | JSON persistence and backup retention |
| `app/index.html`, `styles.css`, `design.css` | Document, base layout and current visual layer; both stylesheets are required |
| `assets/` | Original SVG icon and small generated PNG/ICO assets |
| `scripts/` | UI/icon builds, browser preview and repository/desktop checks |
| `tests/` | Domain/storage tests and main-process IPC tests with mocked OS boundaries |
| `docs/` | Architecture, validation details and a real synthetic-data screenshot |
| `.github/workflows/verify.yml` | Windows dependency installation, checks, desktop smoke and portable build |

The renderer calls the preload API; the main process validates requests, applies shared domain rules, saves through Store and broadcasts fresh snapshots back to the UI. The reminder timer reads the same stored matters and records notification deduplication keys. Browser preview replaces the desktop API with localStorage operations. See [module relationships and file map](docs/architecture.md).

`app/bundle.js` and `app/assets/icon.svg` are generated by `build:ui`. `node_modules/`, `release/`, local EXEs, test profiles, caches, private reports and backups are excluded. Existing local historical outputs are preserved outside version control; reproduce a current EXE with the command below.

## Tests and packaging

```powershell
npm test
npm run build:ui
npm run icons
node scripts/check-repository.cjs
npx --no-install electron scripts/smoke-desktop.cjs
npm run dist
```

Expected: 15 passing tests; a successful repository-check message; desktop smoke JSON containing `"passed":true`; and **`release/XEvent-1.0.2.exe`**. Double-click that portable EXE. Smoke reports/screenshots are written under `artifacts/desktop-smoke/`; all smoke data uses a new OS temporary profile. Third-party notices are included under `app/` in the packaged application.

The existing tests check persistence, backups, reminder deduplication, date errors, input restrictions and IPC operations. OS window/dialog/notification/login APIs are mocked in `tests/main.test.cjs`. The separate desktop smoke runs the actual renderer, preload and IPC with real files. It does **not** prove native notification delivery, login startup or tray clicks. [Evidence, manual checks and limitations](docs/validation.md) distinguish these levels. [GitHub Actions](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/actions) runs the automated sequence on pushes and pull requests; a passing badge must be assessed against the actual run.

## Troubleshooting and project status

- **Dependency download fails:** check access to npm/Electron download hosts and your proxy. Retry `npm ci`. Do not commit personal proxy credentials or replace the lockfile merely to bypass a network problem. An offline clean install is not promised.
- **Dependency audit (2026-10-08):** npm reported eight moderate findings in the electron-builder dependency chain, rooted in `sprintf-js`. No high/critical findings were reported in that audit. The existing dependency versions/lockfile were preserved; this preparation is not a dependency security upgrade. Review `npm audit` before changing that toolchain.
- **Preview cannot connect or is stale:** build the UI first; verify port 4173 is free and keep the preview command running. Browser example dates reflect when that browser profile first loaded them.
- **Notifications are absent:** keep the program running, check Windows notification/Do Not Disturb settings and try the settings test button. Exit, shutdown and sleep prevent timely reminders.
- **Cannot reopen after disabling close-to-tray:** a source-level lifecycle limitation can leave the tray alive with a destroyed window. Keep the default close-to-tray setting and fully quit through the tray menu. This branch does not change the core implementation to fix that issue.
- **Login startup:** available only in a packaged EXE. After moving the EXE, disable then re-enable it to update the stored path. Actual login behavior remains a manual validation item.
- **Distribution:** builds are unsigned; no code-signing certificate or automatic updater is configured. SmartScreen acceptance is not verified. Windows 10, Linux/macOS and alternative architectures are not claimed as tested.

This is a personal project with no maintenance SLA or promised release schedule. Contributions should be small and include relevant tests; keep both READMEs synchronized. Report reproducible problems through [Issues](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/issues), stating OS, Node/Electron version, steps and expected/actual behavior. Use synthetic data in reports and never upload your real `events.json` or credentials.

## License and acknowledgements

The owner has not yet selected a project license. No project license is granted; the licensing decision must be confirmed before source publication.

The XEvent SVG icon is project-authored; PNG/ICO files are generated from it. Screenshots contain project-generated examples. Electron, electron-builder, esbuild, sharp, Lucide (including Feather-derived icons), Marked and DOMPurify are third-party dependencies. Exact bundled-library and direct-tool license texts and source references are retained in [THIRD_PARTY_NOTICES](app/THIRD_PARTY_NOTICES.txt); DOMPurify uses its Apache-2.0 option. Electron includes its Chromium notices in desktop distributions. Dependency licensing remains separate from the project's license.
