# ShellLight

A Windows desktop SSH launcher. Create your own environments, add VMs, and open SSH sessions in Windows Terminal with one click.

## Run

Requires Windows 10/11, Node.js 22.12+ (Node 24 recommended), and the Windows OpenSSH client. Windows Terminal is recommended; PowerShell is the fallback.

```powershell
npm.cmd install
npm.cmd start
```

Create an environment, then add a connection. Choose default SSH configuration, a private key file, password authentication, or SSH agent. Username is optional; leaving it blank uses SSH defaults. A port of 22 preserves any port specified in SSH config; other values explicitly override it. Optional jump hosts support SSH aliases and `user@host:port`.

Click Connect to open a terminal tab. Ordinary connections open in Windows Terminal; saved-password sessions open inside ShellLight. The connection list tracks launches, not live VM health. Several sessions can stay open at once.

### Remember a VM password

Choose **Password (no key required)**, check **Remember password on this computer**, enter the VM password, and save. The password is stored in Windows Credential Manager under your Windows account, separately from JSON settings. Saved-password sessions open an interactive terminal inside ShellLight. On first use, verify and accept the server fingerprint; changed host keys are blocked. Trust records are separate from OpenSSH known_hosts and live in `trusted-hosts.json` next to the connection settings.

Saved-password sessions require a direct host/IP, explicit username, and port. They do not resolve SSH config aliases or support bastions, MFA, or keyboard-interactive authentication. Uncheck Remember password and save to return to Windows Terminal authentication. Leave the password field empty when editing to keep the existing credential; type a new password to replace it. Changing host, port, or username requires entering the password again. Unchecking the option, changing authentication, or deleting the connection removes its stored credential. Duplicated connections require their own password entry. Stored passwords are never returned to the renderer, put into process arguments, or written into temporary files. Credentials stay local to your Windows account.

### Unlock a key from the app

Edit a connection and choose **Private key file**. Select the key, then click **Enable SSH Agent** and accept the Windows administrator prompt to start the Windows OpenSSH Authentication Agent service and enable automatic startup. Click **Unlock key** and enter your passphrase in the unlock window. Keep Private key file authentication selected and save the connection. Later SSH connections can reuse the matching key from the agent without another passphrase prompt while it remains loaded. If it is cleared, unlock it again.

The app never receives or saves your passphrase. Key loading runs as your normal Windows account; only service setup runs elevated. This uses [Microsoft's Windows SSH Agent workflow](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement). Enable auto-start may require administrator approval even when the agent is already running.

Import SSH Config reads concrete Host aliases from your own `%USERPROFILE%\.ssh\config`. OpenSSH resolves their settings at connection time, including HostName, User, IdentityFile, ProxyJump, Include, and wildcard defaults. Import does not expand wildcard aliases or discover aliases inside Include files. Choose an environment before importing to place aliases there; otherwise an Imported environment is created.

Connections and environments persist in `%APPDATA%\ShellLight\connections.json`. Only key file paths are stored there; remembered passwords live in Windows Credential Manager under the `ShellLight` namespace. Private key contents are never copied by the app. Back up the JSON file to preserve your configuration; it contains hostnames and usernames, so treat it as internal configuration. Moving the JSON to another machine does not transfer remembered passwords.

## Verify and package

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd run package
```

The portable Windows executable is generated in `release/shelllight-1.1.2/ShellLight 1.1.2.exe`. Double-click it to launch without Node.js. This local build is unsigned. The smoke test briefly opens the application, verifies the settings bridge and management/terminal separation, and writes isolated test settings and a screenshot under `.smoke-data/`; it never opens an SSH connection.

The desktop uses isolated, sandboxed renderers. Every IPC request checks the registered window, top-level frame, document URL, and permitted role. Terminal windows have a separate preload API and cannot manage connections or credentials. SSH launches use argument arrays and absolute Windows executable paths. Password fields are cleared when the editor closes or authentication settings change. See [SECURITY.md](SECURITY.md) for the dependency audit status and reporting guidance.

There are no preconfigured sample VMs. Environment deletion asks for confirmation and removes its saved connections; it does not affect any VMs or running SSH sessions.

## Publishing the source

Commit `electron/`, `src/`, `scripts/`, `tests/`, `index.html`, `vite.config.mjs`, `package.json`, `package-lock.json`, `.gitignore`, `LICENSE`, `SECURITY.md`, and this README.

Do not commit `node_modules/`, `dist/`, `release/`, `.smoke-data/`, private keys, `.env` files, SSH configuration, connection exports, or screenshots containing real infrastructure or credentials. The `.gitignore` excludes common local artifacts and credential files, but cannot detect secrets inside arbitrary source files. Review staged files with `git diff --cached` before committing. Attach Windows executables separately as GitHub Release assets if you want to distribute builds.

Runtime settings live outside the source directory under the Windows account's app-data folder, and remembered passwords live in Windows Credential Manager. Do not copy these into the repository. Publishing the source does not publish or transfer those credentials. The source includes dummy passwords and an ephemeral key generator for localhost tests; these are not real VM credentials.

This is an early Windows desktop project, not an independently audited security product. Contributors should avoid including terminal output, exported settings, or sensitive host details in public issues.

## License

MIT — see [LICENSE](LICENSE). Third-party dependencies retain their own licenses.

