<p align="center">
  <img src="assets/lgss-icon.png" width="124" alt="LGSS SCUM Server Manager" />
</p>

<h1 align="center">LGSS SCUM Server Manager</h1>

<p align="center">
  <strong>Complete Administration & Control Suite for SCUM Dedicated Servers</strong><br />
  Native Source RCON · Admin Helper & Live Item Dispatch · Multi-Server Orchestration · Trader Economy · Discord Bot · Remote Web & Mobile Access
</p>

<p align="center">
  <a href="https://github.com/4UR3X/ScumServerManager/releases/latest"><img src="https://img.shields.io/badge/Download-LGSS%20Manager%20v1.3.35-ff7a18?style=for-the-badge" alt="Download LGSS Manager" /></a>
  <img src="https://img.shields.io/badge/Windows-10%20%2F%2011%20%2F%20Server%20x64-0078d4?style=for-the-badge" alt="Windows 10 / 11 / Server x64" />
  <img src="https://img.shields.io/badge/Interface-10%20Languages-3fb950?style=for-the-badge" alt="10 Supported Languages" />
  <a href="https://discord.gg/ZBzTRNbTy3"><img src="https://img.shields.io/badge/Discord-Legendary%20Gaming-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Community" /></a>
</p>

<p align="center">
  <a href="#about">About</a> ·
  <a href="#native-rcon">Native RCON</a> ·
  <a href="#admin-helper">Admin Helper</a> ·
  <a href="#features">Core Features</a> ·
  <a href="#economy-config">Config & Economy</a> ·
  <a href="#discord-remote">Discord & Remote</a> ·
  <a href="#tech-stack">Built With</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#license">License</a> ·
  <a href="#contact">Contact</a>
</p>

---

<a id="about"></a>

## About LGSS Manager

**LGSS SCUM Server Manager** is a self-contained Windows desktop and remote administration platform built by **Legendary Gaming (`4UR3X`)** for **SCUM Dedicated Server** owners, communities, and bare-metal host administrators.

It unifies multi-instance server deployment, our custom-engineered **Native Source RCON** engine, real-time spatial item/vehicle dispatch (**Admin Helper**), visual `ServerSettings.ini` & `EconomyOverride.json` editors, raid scheduling, automated crash recovery, SQLite player analytics, Discord bot integration, and remote mobile/browser management inside a single tactical interface.

Everything required to run — including a non-AVX portable database engine compatible with older Xeon / Windows Server 2019+ machines and automatic Visual C++ runtime provisioning — is packaged directly inside the official installer with zero external dependencies.

---

<a id="native-rcon"></a>

## Native Source RCON Engine

**LGSS Manager features a purpose-built x64 C++ / MASM Native Source RCON engine (`dwmapi.dll`) designed specifically for SCUM Dedicated Server.** No third-party RCON wrapper, external injector, or heavy scripting framework is required.

- **True Server-Side Execution:** Hooks directly into the Unreal Engine 4 GameThread inside `SCUMServer.exe` with full server authority.
- **Zero-Player & Zero-Admin Operation:** Execute weather, time, broadcast, kick/ban, fame, currency, teleport, and world-spawn commands with **0 players online** and **no administrator logged into the game**.
- **Standard Valve Source RCON Protocol (TCP):** Listens directly on your configured RCON port (`28015` by default). Fully compatible simultaneously with LGSS Manager, **BattleMetrics**, external Discord bots, and `mcrcon` — even while the LGSS desktop UI is closed.
- **One-Click Deployment & Auto-Healing:** Provisioned automatically onto managed SCUM servers with hot-reloadable configuration (`lgss_rcon.ini`) and instant reconnection after server restarts.
- **Strict Explicit Target Safety:** World-spawn commands strictly validate explicit recipient `SteamID` or `"X Y Z"` coordinates, preventing accidental untargeted drops on live servers.

---

<a id="admin-helper"></a>

## Admin Helper & Spatial Kit Dispatch

Designed for fast, error-free live server moderation and event hosting:

- **Complete 2,785+ Entity Catalog:** Categorized visual browser covering every SCUM firearm, magazine, attachment, armor piece, clothing item, medical supply, food/farming seed, base storage element, keycard, full vehicle, aircraft, boat, animal, and puppet — complete with item icons and smart ranked search.
- **Localized Item Names:** Catalog search and item labels adapt dynamically across supported languages alongside canonical SCUM spawn codes.
- **Live 4-Second Player Coordinate & Facing Sync:** Tracks online players' real-time `X / Y / Z` world coordinates, map sector (`A0–D4`), rotation vector, account balance, and fame points without impacting server tick rate.
- **1-Step-In-Front Delivery:** Select a specific online recipient from the player panel and dispatch single items, multi-item carts, vehicles, or custom **Quick Templates (Kits)** directly 1 step in front of the player's exact facing direction over pipelined RCON.

---

<a id="features"></a>

## Multi-Server Control, Players & Automation

### Server Lifecycle & Watchdog
- Manage **multiple independent SCUM Dedicated Servers** from one workstation with automatic port-collision detection and healing (`Game Port`, `Query Port`, `RCON Port`).
- Install, validate, and update SCUM Dedicated Server builds directly via integrated **SteamCMD** workflows.
- Configure custom launch arguments (`-nobattleye`, `-log`, multi-home bind IP, max players, and custom flags).
- **Automated Restart Scheduler & Crash Watchdog:** Schedule timed or interval restarts with automated in-game `#Announce` countdown warnings before shutdown, plus automatic process recovery on unexpected crashes.
- Live hardware & server telemetry: CPU load, RAM footprint, process uptime, online player count, and safe one-click server reset/wipe workflows.

### Players, Logs & Database Snapshots
- Inspect offline and online player records directly from `SCUM.db` (SteamID64, character names, fame, bank/gold balances, playtime, and last-seen coordinates).
- Manage `AdminUsers.ini`, `ServerSettingsAdminUsers.ini`, `VIP` slots, `WhitelistedUsers.ini`, `BannedUsers.ini`, and `SilencedUsers.ini` visually.
- **Real-Time Log Streamer:** Dedicated live parser for Chat, Kills, Login/Logout, Admin Commands, Violations, Economy, and Gameplay logs.
- **Automated & Manual Backups:** Create compressed snapshots of SCUM save databases and configuration folders with configurable retention limits and safe point-in-time restoration while the server is stopped.

---

<a id="economy-config"></a>

## Configuration, Raid Matrix & Trader Economy

- **Categorized `ServerSettings.ini` Studio:** Edit hundreds of world, metabolism, puppet/animal, vehicle, base-building, drop-ship, and PvP/PvE parameters with clear descriptions, search filtering, and custom raw INI key preservation.
- **Visual Raid Times Editor (`RaidTimes.json`):** Interactive weekly raid schedule matrix supporting multiple daily intervals, timezone awareness, and raid announcements.
- **Full Trader & Economy Studio (`EconomyOverride.json`):** Browse all outpost traders, search 2,750+ tradeable items with icons, bulk-adjust buy/sell multipliers, toggle tradeability/stock rules, and import/export economy presets safely with atomic file writes.

---

<a id="discord-remote"></a>

## Discord Bot & Remote Web / Mobile Panel

- **Per-Server Integrated Discord Bot:** Connect dedicated Discord bots per SCUM server for live player-count status presence, two-way/outbound chat feeds, login/logout tracking, killfeeds, and server lifecycle notifications — localized across 10 languages.
- **JWT-Authenticated Remote Control Panel:** Access the full responsive LGSS interface from any desktop browser, tablet, or smartphone over LAN, VPN, Tailscale, or HTTPS reverse proxy, complete with instant **QR-Code mobile pairing** and API access audit logs.
- **10 Native UI Languages & Tactical Themes:** Switch seamlessly between **English, Turkish, German, Russian, French, Italian, Arabic, Azerbaijani, Thai, and Traditional Chinese**, with customizable tactical color themes and external XAML localization overrides (`Globalization/`).

---

<a id="tech-stack"></a>

## Engineering & Multi-Language Architecture

LGSS Manager is engineered as a hybrid native + asynchronous desktop stack across **9 programming and scripting languages**:

<p align="left">
  <img src="https://img.shields.io/badge/JavaScript%20(ES2024)-React%2019%20%26%20Electron%2032-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Python%203.13-FastAPI%20%26%20AsyncIO-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/C%2B%2B17%20(MSVC%20x64)-Native%20UE4%20RCON%20DLL-00599C?style=flat-square&logo=cplusplus&logoColor=white" alt="C++" />
  <img src="https://img.shields.io/badge/x64%20MASM%20Assembly-Proxy%20Jump%20ABI-6E4C13?style=flat-square" alt="x64 Assembly" />
  <img src="https://img.shields.io/badge/PowerShell-Build%20%26%20Runtime%20Provisioning-5391FE?style=flat-square&logo=powershell&logoColor=white" alt="PowerShell" />
  <img src="https://img.shields.io/badge/CSS3-Tailwind%20Tactical%20UI-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/HTML5-Desktop%20%26%20Remote%20Web%20Shell-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/NSIS-Custom%20Windows%20Setup-2C8EBB?style=flat-square" alt="NSIS" />
  <img src="https://img.shields.io/badge/Windows%20Batch-MSVC%20Toolchain%20Automation-4D4D4D?style=flat-square&logo=gnubash&logoColor=white" alt="Batchfile" />
</p>

| Layer | Languages & Technologies | Purpose |
| :--- | :--- | :--- |
| **Desktop & Remote UI** | **JavaScript (JSX)**, **CSS3 (Tailwind)**, **HTML5**, Electron 32, React 19 | Multi-theme desktop shell, catalog virtualization, and responsive mobile/browser dashboard |
| **Core Backend Service** | **Python**, FastAPI, AsyncIO, Motor, SQLite3, `discord.py` | Process supervision, INI/JSON atomic parsers, RCON pipelining, Discord bots, and JWT Remote API |
| **In-Process RCON Engine** | **C++ (MSVC x64)**, **x64 MASM Assembly** | `dwmapi.dll` Unreal Engine 4 GameThread command dispatcher & Valve Source RCON TCP server |
| **Packaging & Provisioning** | **PowerShell**, **NSIS**, **Batchfile**, XAML | Non-AVX MongoDB bundling, silent VC++ runtime setup, MSVC compilation, and 10-locale dictionary packs |

> Public client integration examples and RCON / Remote API reference utilities across these languages are available in the [`toolkit/`](toolkit) directory.

---

<a id="installation"></a>

## Getting Started & Installation

1. Download **`LGSS-Manager-Setup-1.3.35.exe`** from the **[Official Releases Page](https://github.com/4UR3X/ScumServerManager/releases/latest)**.
2. Run the installer on **Windows 10 / 11** or **Windows Server 2019 / 2022 / 2025 (x64)** with Administrator privileges.
3. Select your root management workspace folder on first launch, then either **install a fresh SCUM Dedicated Server via SteamCMD** or **import an existing server directory**.
4. Open the **RCON** tab (Native Source RCON activates automatically on server launch) and configure **Discord**, **Automation**, and **Remote API** modules as needed.
5. Future releases can be downloaded and installed directly from the in-app **Manager Update** button.

**Windows SmartScreen Notice:** Because community builds are not signed with an Extended Validation (EV) hardware certificate, Windows SmartScreen may display an *"Unknown Publisher"* prompt on first download. Always verify you downloaded the installer from `github.com/4UR3X/ScumServerManager/releases`, then click **More info → Run anyway**.

---

<a id="license"></a>

## License

**LGSS SCUM Server Manager** is an independent proprietary software suite developed by **Legendary Gaming (`4UR3X`)**, distributed under the **[End User License Agreement (EULA)](LICENSE)**. Free to use on SCUM Dedicated Servers that you own or are authorized to administer.

Selling the software, charging for download access, claiming authorship, reverse-engineering bundled binaries, or redistributing modified/rebranded builds is strictly prohibited. Third-party runtime components retain their respective licenses — see [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).

This repository hosts official installers, auto-update metadata, documentation, and public client integration examples. **Proprietary Manager source code is not published.**

---

<a id="contact"></a>

## Contact & Official Channels

- **Author:** `4UR3X` · **Legendary Gaming**
- **Official Discord:** [discord.gg/ZBzTRNbTy3](https://discord.gg/ZBzTRNbTy3)
- **Official Releases:** [github.com/4UR3X/ScumServerManager/releases](https://github.com/4UR3X/ScumServerManager/releases)
- **Security Reports:** See [SECURITY.md](SECURITY.md)

Never include Discord bot tokens, RCON passwords, JWT keys, or private player data in public messages.

*LGSS SCUM Server Manager is an independent community tool and is not an official product of Gamepires or Jagex.*

<p align="center">© 2026 Legendary Gaming · 4UR3X · LGSS SCUM Server Manager</p>
