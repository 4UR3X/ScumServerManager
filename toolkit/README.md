# LGSS Platform Integration Toolkit (`v1.3.35`)

Public reference clients, diagnostics, UI tokens, and schema templates representing the multi-language architecture powering **LGSS SCUM Server Manager**:

- **JavaScript (`lgssRemoteClient.js`)** — Electron / React Remote Control REST client
- **Python (`lgss_rcon_client.py`)** — FastAPI / Discord / Source RCON client (`SERVERDATA_AUTH` & `SERVERDATA_EXECCOMMAND`)
- **C++ (`lgss_source_rcon.cpp`)** — Native Winsock2 TCP Source RCON wire protocol implementation
- **PowerShell (`Invoke-LgssHealthCheck.ps1`)** — Windows Server port, process, and RCON health diagnostics
- **CSS (`lgss-tactical-tokens.css`)** — LGSS Tactical Dark UI design tokens
- **HTML (`server-status-embed.html`)** — Standalone embeddable server status card
- **XML / XAML (`lgss-localization-schema.xaml`)** — 10-language localization `ResourceDictionary` schema
- **Batchfile (`lgss-quick-diag.bat`)** — Quick Windows firewall and RCON port verification script
- **Assembly (`x64_proxy_abi_reference.asm`)** — x64 MASM PE export-forwarding ABI reference
- **NSIS (`lgss_env_check.nsi`)** — Windows x64 installer environment pre-check macro

> Core **LGSS Manager** application binaries are distributed exclusively as compiled releases on the [Releases](https://github.com/4UR3X/ScumServerManager/releases/latest) page.
