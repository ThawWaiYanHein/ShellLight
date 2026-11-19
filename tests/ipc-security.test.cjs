const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createIpcSecurity } = require('../electron/ipc-security.cjs');
const page = 'file:///C:/ShellLight/dist/index.html';
function fixture() {
  const handlers = new Map();
  const listeners = new Map();
  const ipc = createIpcSecurity({ handle: (channel, handler) => handlers.set(channel, handler), on: (channel, handler) => listeners.set(channel, handler) });
  const makeWindow = (id, url) => {
    const webContents = Object.assign(new EventEmitter(), { id, mainFrame: { url }, isDestroyed: () => false });
    return { webContents };
  };
  const manager = makeWindow(1, page), terminal = makeWindow(2, page + '?terminal=1');
  ipc.register(manager, 'manager', page); ipc.register(terminal, 'terminal', page + '?terminal=1');
  let writes = 0;
  ipc.handle('save', 'manager', () => ++writes);
  let input = '';
  ipc.listen('session-input', 'manager', (_, value) => { input = value; });
  const event = window => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  return { handlers, listeners, manager, terminal, event, makeWindow, writes: () => writes, input: () => input };
}
test('registered manager can use its manager IPC channels', () => {
  const f = fixture();
  assert.equal(f.handlers.get('save')(f.event(f.manager)), 1);
  f.listeners.get('session-input')(f.event(f.manager), 'ls\r');
  assert.equal(f.input(), 'ls\r');
});
test('terminal-role windows cannot manage settings or send session input', () => {
  const f = fixture();
  assert.throws(() => f.handlers.get('save')(f.event(f.terminal)), /denied/);
  f.listeners.get('session-input')(f.event(f.terminal), 'rm');
  assert.equal(f.input(), '');
  assert.equal(f.writes(), 0);
});
test('unregistered windows and spoofed webContents IDs cannot use IPC', () => {
  const f = fixture();
  for (const window of [f.makeWindow(3, page), f.makeWindow(1, page)]) assert.throws(() => f.handlers.get('save')(f.event(window)), /denied/);
  assert.equal(f.writes(), 0);
});
test('child frames and missing frames are denied even at the application URL', () => {
  const f = fixture();
  for (const senderFrame of [{ url: page }, null]) assert.throws(() => f.handlers.get('save')({ ...f.event(f.manager), senderFrame }), /denied/);
  assert.equal(f.writes(), 0);
});
test('navigated documents and manipulated query strings are denied', () => {
  const f = fixture();
  for (const url of ['https://attacker.invalid/', 'about:blank', page + '?terminal=1', page + '#other']) {
    f.manager.webContents.mainFrame.url = url;
    assert.throws(() => f.handlers.get('save')(f.event(f.manager)), /denied/);
  }
  assert.equal(f.writes(), 0);
});
test('destroyed windows lose IPC authorization', () => {
  const f = fixture();
  f.manager.webContents.emit('destroyed');
  assert.throws(() => f.handlers.get('save')(f.event(f.manager)), /denied/);
  f.terminal.webContents.isDestroyed = () => true;
  assert.throws(() => f.handlers.get('session-input')(f.event(f.terminal)), /denied/);
});
