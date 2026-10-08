[简体中文](README.zh-CN.md) · English

# Deadline Tracker - XEvent

**A Windows desktop workspace that connects important deadlines with plans, progress and the next follow-up.**

## Value

An application, project or major life commitment needs more than a due date: it also needs a plan, a record of what has changed, and a clear next action. XEvent keeps these together so a user can see **what needs attention, how far it has progressed, and what to do next**.

Built for personal study, work and life planning, it combines independent deadline/follow-up times, goals, strategy, checklist progress and Markdown notes. Cards, a list, a status board and a deadline timeline provide different views of the same matters. Data stays local; routine use needs no account or network connection. This is a single-user application without cloud synchronization or collaboration.

## My contribution — Sean-xzx

I initiated and directed this personal project, using **AI assistance for implementation, testing and repository preparation**. My contribution focused on:

- **Requirements and product decisions:** defined the mixed study/work/life use case and the need to connect deadlines with follow-up, progress and next actions.
- **Interface review and iteration:** reviewed the running application, identified an incomplete sidebar and excessive motivational copy, and directed revisions toward clearer hierarchy and a restrained interface.
- **Delivery requirements:** drove the work toward a runnable Windows EXE, recoverable local data, bilingual documentation and verification from a clean repository copy.

These contributions demonstrate requirements analysis, interface evaluation and delivery judgment. The code and validation below show the resulting implementation; this is not a claim of independently hand-writing every component.

## Engineering approach

- **Separate deadline from follow-up.** A matter can require follow-up without having a deadline. Shared rules rank overdue, due-for-follow-up and approaching-deadline matters; persisted notification keys prevent repeated reminders for the same trigger. See [domain rules](app/domain.cjs).
- **Share rules across runtime boundaries.** The renderer and Electron main process use the same validation/progress logic. A restricted preload API connects the UI to desktop operations; Markdown is parsed with Marked and sanitized with DOMPurify. The browser preview uses a separate localStorage adapter. See [architecture and file map](docs/architecture.md).
- **Make local data recoverable.** JSON saves write a temporary file before renaming; up to 14 backups are retained. Imports are validated, then merged by ID and newer update time while retaining local preferences. Completion/reopening and trash/restore preserve the matter's records. See [storage](app/store.cjs).

These are practical design choices for this product; no novel algorithm or research finding is claimed.

## Demonstrated results

| Evidence | What it establishes |
| --- | --- |
| Real Electron screenshot below | The desktop UI renders the built-in synthetic matters |
| **15 passing automated tests** | Domain rules, persistence, backups and IPC handling; OS APIs are mocked in main-process tests |
| **Passing real desktop smoke test** | Renderer, preload, IPC and disk persistence work together through create/update/trash/restore, invalid-date rejection and page reload |
| **Successful Windows x64 portable build from a clean remote clone** | The documented dependency/build workflow produces `release/XEvent-1.0.2.exe` |

The tested source commit `98929fd` also has a [successful Windows CI run](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/actions/runs/37738822673). [Validation details](docs/validation.md) distinguish automated evidence from manual checks.

![Real Electron desktop with synthetic example matters](docs/images/overview.png)

The six examples include five unfinished matters and one completed matter. Dates, IDs and timestamps vary by run. These are functional/build results; no user study or measured productivity improvement is claimed. Native notification delivery, login startup and tray interactions still require manual verification.

## Run and verify

Version **1.0.2**, data format **1**, Simplified Chinese UI. Verified on **Windows 11 Home x64 (build 26200), Node.js 22.23.2, npm 10.9.8 and Electron 44.5.1**. Dependencies require Node >=22.12.0; other development Node versions are unverified.

Setup needs Git and network access to npm, Electron and packaging downloads; no private project credentials, external dataset, model or paid service is required. Installation/build output occupies hundreds of MB and a fresh build can take several minutes. EXE users do not need Node.js. These instructions document owner-authorized use; they do not grant permission. See [rights](RIGHTS.md).

In PowerShell:

```powershell
git clone https://github.com/Sean-xzx/Deadline-Tracker-XEvent.git
cd Deadline-Tracker-XEvent
npm ci
node node_modules/electron/install.js
npm test
npm start
```

**Success:** 15 tests pass and a window titled `XEvent · 重大事项` opens. A new desktop profile starts empty; existing local data is retained. Select `载入示例` to see six synthetic matters: five in the overview and one under `已完成`. For a minimal editing example, create a matter with separate deadline/follow-up times and two checklist stages; marking one stage done yields **50% progress**.

For browser preview, run `npm run build:ui`, then `npm run preview` and open [localhost:4173](http://127.0.0.1:4173). A fresh browser profile loads the examples automatically; Ctrl+C stops the server. Browser data is separate and Windows notification/tray/login integration is unavailable.

After setup, verify resources and build the portable EXE:

```powershell
npm run build:ui
npm run icons
node scripts/check-repository.cjs
npx --no-install electron scripts/smoke-desktop.cjs
npm run dist
```

**Success:** repository checks pass, the smoke report contains `"passed":true`, and `release/XEvent-1.0.2.exe` is generated. Double-click the EXE to open it. The smoke uses an isolated temporary profile and writes reports/screenshots to `artifacts/desktop-smoke/`. [GitHub Actions](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/actions) runs these checks on pushes and pull requests.

## Data, implementation and limitations

No `.env` is needed. Settings control theme, reminders, tray residency and optional packaged-EXE login startup. Defaults are light theme, notifications and close-to-tray enabled, login startup disabled, a 09:00 daily summary and three days' deadline lead time. Desktop data is in `%APPDATA%/XEvent/events.json`; settings can open the actual directory and export/import backups. Exports include completed/trashed matters and are **not encrypted**. `XEVENT_DATA_DIR` selects an isolated test directory and skips packaged Windows shortcut registration; set it before launching and remove it afterwards.

The entry point is `app/main.cjs`. UI source `src/renderer.js` calls `app/preload.cjs`; the main process validates requests through `app/domain.cjs`, persists them through `app/store.cjs`, then broadcasts snapshots to the UI. `build:ui` generates the renderer bundle. Both `app/styles.css` and `app/design.css` are required. Dependencies, build output, private data, caches and backups are excluded from Git.

- **OS integration:** reminders need the app running; shutdown, sleep and Windows notification settings affect delivery. Disabling close-to-tray can leave a tray with a destroyed window and prevent reopening; retain the default and fully quit via the tray menu. Moving a packaged EXE requires toggling login startup off/on to update its path.
- **Compatibility/distribution:** Windows 10, macOS/Linux, alternative architectures, other Node versions and SmartScreen are unverified. Builds are unsigned and have no automatic updater.
- **Dependencies:** the 2026-10-08 audit reported eight moderate findings in the electron-builder chain via `sprintf-js`, with no high/critical findings. The original lockfile is retained. For failed downloads, check network/proxy access; offline clean installation is not promised.

Further reading: [architecture and each file's role](docs/architecture.md), [verification commands and manual checks](docs/validation.md), [Chinese user guide](使用说明.md). This personal project has no maintenance SLA or promised release schedule. Report issues with versions, reproduction steps and synthetic data through [Issues](https://github.com/Sean-xzx/Deadline-Tracker-XEvent/issues); do not upload personal records or credentials. Code contributions and functional modifications require prior written permission.

## Rights and resource sources

Copyright (c) 2026 Sean-xzx. **All rights reserved; no open-source license is granted.** Public visibility permits review under GitHub's terms. Running, building, modifying, reusing or redistributing project-owned materials requires prior written permission, except where applicable law or platform terms provide otherwise. See the bilingual [rights notice](RIGHTS.md).

The project-authored SVG generates the PNG/ICO icon; screenshots use project-generated synthetic examples. Electron, electron-builder, esbuild, sharp, Lucide (including Feather-derived icons), Marked and DOMPurify have independent third-party terms, retained with source references in [THIRD_PARTY_NOTICES](app/THIRD_PARTY_NOTICES.txt). DOMPurify uses its Apache-2.0 option; Electron distributions include Chromium notices. These terms do not license the project's own materials.
