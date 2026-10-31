# Security

ShellLight is an early-stage Windows desktop application. It has not had an independent security audit.

The renderer is sandboxed with Node integration disabled. IPC calls are limited to registered top-level application frames and checked against window roles. Connection management and terminal windows have separate preload APIs. Saved passwords are held in Windows Credential Manager; they are not included in JSON settings or sent back to the renderer. SSH sessions still require trusting the correct server key.

To check dependencies:

```powershell
npm.cmd audit
npm.cmd audit --omit=dev
```

As of October 31, 2026, the full audit reports 15 moderately affected development dependencies in the Electron packaging toolchain, rooted in [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The installed runtime dependencies report no known vulnerabilities. The latest `electron-builder` and `@electron/asar` still depend on older minimatch versions; npm reports no compatible automatic fix. A blanket override to minimatch 11 would cross several major API versions, including callers that require the old callable CommonJS API. These advisories have not been suppressed or silently forced past compatibility checks. Build only trusted source with trusted packaging patterns, and review upstream updates before distributing builds. This status is a snapshot, not a guarantee about future advisories.

When reporting an issue, never attach private keys, passwords, exported connection settings, or identifiable VM output. Use GitHub's private vulnerability reporting if the repository has it enabled. Public issues should contain only redacted information; avoid publishing exploit details involving actual systems or credentials.
