const { execFile } = require('node:child_process');
const { windowsTools } = require('./windows-tools.cjs');
const fs = require('node:fs/promises');
const { expandHome } = require('./ssh.cjs');
const encode = script => Buffer.from(script, 'utf16le').toString('base64');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const powershell = () => windowsTools().powershell;
const sshAdd = () => windowsTools().sshAdd;
function runScript(script, timeout = 20000) {
  return new Promise((resolve, reject) => execFile(powershell(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', encode(script)], { windowsHide: true, timeout }, (error, stdout, stderr) => {
    if (error) reject(new Error(stderr.trim() || 'Operation cancelled or failed. Check Windows SSH Agent and try again.'));
    else resolve(stdout.trim());
  }));
}
async function status() {
  const text = await runScript(`$s = Get-Service ssh-agent -ErrorAction SilentlyContinue; if ($null -eq $s) { 'Missing' } else { $s.Status.ToString() }`);
  return { running: text === 'Running', service: text };
}
function windowScript(script, elevated) {
  return `$ErrorActionPreference = 'Stop'; try { $p = Start-Process -FilePath ${quote(powershell())} -ArgumentList '-NoProfile -EncodedCommand ${encode(script)}' ${elevated ? '-Verb RunAs -WindowStyle Hidden' : '-WindowStyle Normal'} -PassThru -Wait; exit $p.ExitCode } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`;
}
async function setup() {
  await runScript(windowScript(`$ErrorActionPreference = 'Stop'; try { Set-Service ssh-agent -StartupType Automatic; Start-Service ssh-agent; exit 0 } catch { exit 1 }`, true), 180000);
  const result = await status();
  if (!result.running) throw new Error('SSH Agent did not start. Check that Windows OpenSSH Client is installed.');
  return result;
}
function unlockScript(file) {
  if (typeof file !== 'string' || !file.trim() || /[\x00-\x1f]/.test(file)) throw new Error('Select a private key file first.');
  return `$Host.UI.RawUI.WindowTitle = 'ShellLight - Unlock private key'; Write-Host 'Enter your key passphrase to add it to Windows SSH Agent.'; & ${quote(sshAdd())} ${quote(expandHome(file))}; $result = $LASTEXITCODE; if ($result -ne 0) { Write-Host 'Key was not added. Check the passphrase and key permissions.'; Read-Host 'Press Enter to close' }; exit $result`;
}
async function unlock(file) {
  const script = unlockScript(file);
  await fs.access(expandHome(file));
  if (!(await status()).running) throw new Error('SSH Agent is not running. Click Enable SSH Agent first.');
  await runScript(windowScript(script, false), 600000);
  return { added: true };
}
module.exports = { status, setup, unlock, unlockScript, windowScript };
