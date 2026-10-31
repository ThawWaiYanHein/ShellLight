const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { createIpcSecurity } = require('./ipc-security.cjs');
const { sshLaunchPlan } = require('./windows-tools.cjs');
const { validateConnection, sshArgs, parseConfig, expandHome } = require('./ssh.cjs');
const agent = require('./agent.cjs');
const passwords = require('./passwords.cjs');
const { connectPassword } = require('./password-session.cjs');
const sessions = new Map();
const ipc = createIpcSecurity(ipcMain);
const applicationURL = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
let state = { version: 1, environments: [], connections: [] };
let mainWindow;
let saveQueue = Promise.resolve();
app.setPath('userData', path.join(app.getPath('appData'), 'ShellLight'));
if (process.argv.includes('--smoke-test')) app.setPath('userData', path.join(__dirname, '../.smoke-data'));
const settingsPath = () => path.join(app.getPath('userData'), 'connections.json');
function validateState(data) {
  if (!data || !Array.isArray(data.environments) || !Array.isArray(data.connections)) throw new Error('Invalid settings format.');
  const ids = new Set();
  for (const e of data.environments) {
    if (!e.id || ids.has(e.id) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 60 || !['green','blue','amber','purple','red'].includes(e.color)) throw new Error('Invalid environment.');
    ids.add(e.id);
  }
  const connectionIds = new Set();
  for (const c of data.connections) {
    validateConnection(c);
    passwords.validateRemembered(c);
    delete c.password;
    if (!ids.has(c.environmentId) || typeof c.id !== 'string' || connectionIds.has(c.id)) throw new Error('Invalid connection environment or ID.');
    connectionIds.add(c.id);
  }
  return { version: 1, environments: data.environments, connections: data.connections };
}
function launch(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', shell: false, windowsHide: false });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
app.whenReady().then(async () => {
  try { state = validateState(JSON.parse(await fs.readFile(settingsPath(), 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') { dialog.showErrorBox('Cannot read saved connections', `Your settings file was left untouched.\n${error.message}\n${settingsPath()}`); app.quit(); return; } }
  ipc.handle('load', 'manager', () => state);
  ipc.handle('agent-status', 'manager', () => agent.status());
  ipc.handle('agent-setup', 'manager', () => agent.setup());
  ipc.handle('agent-unlock', 'manager', (_, file) => agent.unlock(file));
  ipc.handle('save', 'manager', (_, data, credential) => {
    const next = validateState(data);
    const operation = saveQueue.catch(() => {}).then(async () => {
      for (const c of next.connections.filter(c => c.rememberPassword)) {
        if (credential?.id === c.id && typeof credential.password === 'string' && credential.password.length) passwords.set(c, credential.password);
        if (!passwords.get(c)) throw new Error('Enter a password to remember for this connection.');
      }
      await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
      await fs.writeFile(settingsPath() + '.tmp', JSON.stringify(next, null, 2), { mode: 0o600 });
      await fs.rename(settingsPath() + '.tmp', settingsPath());
      const previous = state;
      state = next;
      for (const old of previous.connections.filter(c => c.rememberPassword)) {
        const replacement = next.connections.find(c => c.id === old.id);
        if (!replacement?.rememberPassword || passwords.account(old) !== passwords.account(replacement)) passwords.remove(old);
      }
      return state;
    });
    saveQueue = operation;
    return operation;
  });
  ipc.handle('session-input', 'terminal', (event, data) => {
    if (typeof data === 'string' && data.length <= 1048576) sessions.get(event.sender.id)?.client?.input(data);
  });
  ipc.handle('session-resize', 'terminal', (event, cols, rows) => {
    if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0 && cols < 1000 && rows < 1000) sessions.get(event.sender.id)?.client?.resize(cols, rows);
  });
  ipc.handle('session-start', 'terminal', async event => {
    const session = sessions.get(event.sender.id);
    if (!session || session.started) return;
    session.started = true;
    const c = session.connection;
    const password = passwords.get(c);
    if (!password) throw new Error('Saved password is missing. Edit the connection and enter it again.');
    const send = payload => { if (!event.sender.isDestroyed()) event.sender.send('session-event', payload); };
    session.client = connectPassword(c, password, (fingerprint, done) => {
      (async () => {
        const file = path.join(app.getPath('userData'), 'trusted-hosts.json');
        let hosts = {};
        try { hosts = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        const name = `${c.host}:${c.port}`;
        if (hosts[name] === fingerprint) { done(true); return; }
        if (hosts[name]) throw new Error('Server host key changed. Connection blocked. Verify the server with your administrator before updating trusted-hosts.json.');
        const response = await dialog.showMessageBox(session.window, { type: 'warning', title: 'Verify SSH server', message: `Trust ${name}?`, detail: `Verify this SHA256 fingerprint with your server administrator:\n${Buffer.from(fingerprint, 'hex').toString('base64').replace(/=+$/, '')}\n\nThis is the first saved-password connection to this server.`, buttons: ['Cancel', 'Trust and connect'], defaultId: 0, cancelId: 0 });
        if (response.response !== 1) { done(false); return; }
        // Re-read after the dialog to preserve other concurrently trusted hosts.
        try { hosts = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (hosts[name] && hosts[name] !== fingerprint) throw new Error('Server host key changed. Connection blocked.');
        hosts[name] = fingerprint;
        await fs.writeFile(file, JSON.stringify(hosts, null, 2)); done(true);
      })().catch(error => { send({ type: 'error', message: error.message }); done(false); });
    }, { ready: () => send({ type: 'ready' }), data: data => send({ type: 'data', data }), error: message => send({ type: 'error', message }), close: () => send({ type: 'close' }) });
  });
  ipc.handle('pick-key', 'manager', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Select SSH private key', properties: ['openFile'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipc.handle('import-ssh', 'manager', async () => {
    const config = path.join(os.homedir(), '.ssh', 'config');
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Import SSH config', defaultPath: config, properties: ['openFile'] });
    if (result.canceled) return null;
    if (path.resolve(result.filePaths[0]).toLowerCase() !== path.resolve(config).toLowerCase()) throw new Error('Import your ~/.ssh/config file. SSH will resolve its aliases, keys and jump hosts when connecting.');
    return parseConfig(await fs.readFile(config, 'utf8'));
  });
  ipc.handle('connect', 'manager', async (_, id) => {
    const c = state.connections.find(c => c.id === id);
    if (!c) throw new Error('Connection no longer exists.');
    if (c.auth === 'password' && c.rememberPassword) {
      if (!passwords.get(c)) throw new Error('Saved password is missing. Edit the connection and enter it again.');
      const window = new BrowserWindow({ width: 1050, height: 720, title: `${c.name} — ShellLight`, backgroundColor: '#13251e', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'session-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
      ipc.register(window, 'terminal', applicationURL + '?terminal=1');
      const senderId = window.webContents.id;
      sessions.set(senderId, { window, connection: { ...c }, started: false });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', e => e.preventDefault());
      window.on('closed', () => { sessions.get(senderId)?.client?.close(); sessions.delete(senderId); });
      await window.loadFile(path.join(__dirname, '../dist/index.html'), { query: { terminal: '1' } });
      return { launched: true };
    }
    const args = sshArgs(c);
    const plan = sshLaunchPlan(args);
    if (c.auth === 'key') await fs.access(expandHome(c.keyPath));
    try { await launch(plan.terminal.command, plan.terminal.args); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await launch(plan.fallback.command, plan.fallback.args);
    }
    return { launched: true };
  });
  mainWindow = new BrowserWindow({ width: 1260, height: 840, minWidth: 940, minHeight: 640, title: 'ShellLight', backgroundColor: '#f6f8fa', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  ipc.register(mainWindow, 'manager', applicationURL);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', e => e.preventDefault());
  await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  if (process.argv.includes('--smoke-test')) {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`(async () => {
        for (let i = 0; i < 50 && !document.getElementById('root').textContent.includes('Environments'); i++) await new Promise(r => setTimeout(r, 100));
        const original = await window.shelllight.load();
        const sample = { version: 1, environments: [{ id: 'test-env', name: 'QA', color: 'blue' }], connections: [{ id: 'test-vm', environmentId: 'test-env', name: 'Test VM', host: 'example.invalid', port: '22', username: '', auth: 'password', keyPath: '', jumpHost: '' }] };
        await window.shelllight.save(sample);
        const saved = await window.shelllight.load();
        const secret = 'shelllight-smoke-test-only';
        sample.connections[0].rememberPassword = true;
        sample.connections[0].username = 'smoke-user';
        await window.shelllight.save(sample, { id: 'test-vm', password: secret });
        const withPassword = await window.shelllight.load();
        const passwordBridge = withPassword.connections[0].rememberPassword && !JSON.stringify(withPassword).includes(secret);
        await window.shelllight.save(original);
        const agentStatus = await window.shelllight.agentStatus();
        return { bridge: !!original, passwordBridge, agentBridge: typeof agentStatus.running === 'boolean' && typeof window.shelllight.unlockKey === 'function' && typeof window.shelllight.setupAgent === 'function', persistence: saved.connections[0]?.host === 'example.invalid', title: document.title, root: document.getElementById('root').textContent };
      })()`);
      const terminalWindow = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'session-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
      ipc.register(terminalWindow, 'terminal', applicationURL + '?terminal=1');
      await terminalWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { terminal: '1' } });
      result.separateBridges = await terminalWindow.webContents.executeJavaScript(`typeof window.shelllight.sessionStart === 'function' && !('save' in window.shelllight) && !('load' in window.shelllight) && !('setupAgent' in window.shelllight)`);
      terminalWindow.destroy();
      await fs.writeFile(path.join(__dirname, '../.smoke-data/preview.png'), (await mainWindow.webContents.capturePage()).toPNG());
      console.log(JSON.stringify(result));
      const cleared = !passwords.get({ id: 'test-vm', host: 'example.invalid', port: '22', username: 'smoke-user' });
      app.exit(result.bridge && result.separateBridges && result.passwordBridge && cleared && result.agentBridge && result.persistence && result.root.includes('Environments') ? 0 : 1);
    } catch (e) { console.error(e); app.exit(1); }
  }
});
app.on('window-all-closed', () => app.quit());
