# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities **privately** through the official **Legendary Gaming** Discord community:

- **Official Discord:** https://discord.gg/ZBzTRNbTy3

Do **not** open public GitHub issues containing exploit details, RCON passwords, JWT secrets, Discord bot tokens, or private player information.

## Scope

Valid security reports include:

- Authentication or authorization flaws in the optional Remote Web API
- Path traversal or unsafe file-system operations
- Source RCON authentication handling issues in `dwmapi.dll`
- Update-channel or installer integrity issues

## Administrator Best Practices

- Keep RCON ports firewalled to trusted hosts unless external RCON tools (such as BattleMetrics) require access, and always use strong unique RCON passwords.
- Use strong credentials and HTTPS / VPN (Tailscale, WireGuard, or Cloudflare Tunnel) when exposing the Remote Web Panel outside your local network.
- Never share `lgss_rcon.ini`, `.env` files, or Discord bot tokens in public screenshots or support channels.
