const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { execFile } = require('node:child_process');
const os = require('node:os');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const { sshArgs, validateConnection } = require('./ssh.cjs');
const { windowsTools } = require('./windows-tools.cjs');

const execFileAsync = promisify(execFile);

async function findVSCode(env = process.env) {
  const localAppData = env.LOCALAPPDATA || path.win32.join(env.USERPROFILE || os.homedir(), 'AppData', 'Local');
  const candidates = [
    path.win32.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Microsoft VS Code', 'Code.exe'),
    path.win32.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft VS Code', 'Code.exe'),
    path.win32.join(localAppData, 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
  ];

  try {
    const { stdout } = await execFileAsync(path.win32.join(env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe'), ['code'], { windowsHide: true });
    for (const match of stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
      candidates.push(path.win32.basename(match).toLowerCase() === 'code.cmd'
        ? path.win32.resolve(path.win32.dirname(match), '..', 'Code.exe')
        : match);
    }
  } catch { /* Check the standard installation paths above. */ }

  for (const candidate of [...new Set(candidates)]) {
    try { await fs.access(candidate); return candidate; } catch { /* Try the next location. */ }
  }
  throw new Error('Visual Studio Code was not found. Install VS Code, then try again.');
}

async function openInVSCode(connection, userDataPath) {
  validateConnection(connection);
  const codePath = await findVSCode();
  const workspaceId = createHash('sha256').update(String(connection.id)).digest('hex');
  const workspacePath = path.join(userDataPath, 'vscode-workspaces', workspaceId);
  const vscodePath = path.join(workspacePath, '.vscode');
  await fs.mkdir(vscodePath, { recursive: true });

  const task = {
    label: `ShellLight: SSH to ${connection.name}`,
    type: 'process',
    command: windowsTools().ssh,
    args: sshArgs(connection),
    problemMatcher: [],
    presentation: { reveal: 'always', focus: true, panel: 'dedicated' },
    runOptions: { runOn: 'folderOpen' },
  };
  await fs.writeFile(path.join(vscodePath, 'tasks.json'), JSON.stringify({ version: '2.0.0', tasks: [task] }, null, 2), { mode: 0o600 });

  return new Promise((resolve, reject) => {
    const child = spawn(codePath, ['--new-window', workspacePath], { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

module.exports = { openInVSCode };
