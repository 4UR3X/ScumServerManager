# Security Policy

## Reporting

Report security issues privately through the official Discord:

https://discord.gg/ZBzTRNbTy3

Do not open public issues for vulnerabilities, credential exposure, bypasses,
or deployment-sensitive details.

## Scope

Security reports may include:

- Credential or token exposure
- Remote API authentication issues
- Unsafe file operations
- Installer or update-channel integrity issues
- Server lifecycle actions that can be triggered without authorization

## Repository Hygiene

The following must never be committed:

- `.env` files
- API tokens or bot tokens
- Customer/server credentials
- SCUM server save data
- MongoDB runtime data
- Generated installers and build artifacts
