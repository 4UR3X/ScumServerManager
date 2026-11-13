# LGSS Public Integration & Platform Reference Kit (`toolkit/`)

This directory provides **public, non-proprietary integration examples and diagnostic utilities** for interacting with **LGSS SCUM Server Manager**'s Remote REST API and Native Source RCON TCP server across all engineering languages used in the LGSS platform:

- **`javascript/lgssRemoteClient.js`** — ES2024 client SDK for the JWT-secured LGSS Remote API, island sector math, and targeted spawn helpers.
- **`python/lgss_rcon_client.py`** — Async & synchronous Valve Source RCON TCP client with pipelined batch execution and `#ListPlayers` parser.
- **`cpp/lgss_source_rcon.hpp`** — Header-only C++17 Winsock2 Source RCON frame serializer and session helper.
- **`powershell/Invoke-LgssHealthCheck.ps1`** — Windows Server firewall, VC++ runtime, UDP game port, and RCON port diagnostic tool.
- **`theme/lgss-tactical-tokens.css`** & **`widget/server-status-embed.html`** — Embeddable HTML5/CSS3 server status card widget.
- **`native-abi/x64_proxy_abi_reference.asm`** — Win64 MASM indirect jump-slot ABI alignment reference.
- **`installer/lgss_env_check.nsh`** — NSIS x64 & VC++ Redistributable prerequisite verification macros.
- **`cli/lgss-quick-diag.bat`** — Lightweight Windows CMD process & port readiness check.

<!-- Release v1.3.35 -->
