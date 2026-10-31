const path = require('node:path');
const os = require('node:os');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
function windowsTools(env = process.env, home = os.homedir()) {
  const root = env.SystemRoot || 'C:\\Windows';
  const local = env.LOCALAPPDATA || path.win32.join(home, 'AppData', 'Local');
  return {
    ssh: path.win32.join(root, 'System32', 'OpenSSH', 'ssh.exe'),
    sshAdd: path.win32.join(root, 'System32', 'OpenSSH', 'ssh-add.exe'),
    powershell: path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    terminal: path.win32.join(local, 'Microsoft', 'WindowsApps', 'wt.exe'),
  };
}
function sshLaunchPlan(args, tools = windowsTools()) {
  const script = `& ${quote(tools.ssh)} ${args.map(quote).join(' ')}`;
  return {
    terminal: { command: tools.terminal, args: ['-w', '0', 'new-tab', '--', tools.ssh, ...args] },
    fallback: { command: tools.powershell, args: ['-NoProfile', '-NoExit', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')] },
  };
}
module.exports = { windowsTools, sshLaunchPlan };
