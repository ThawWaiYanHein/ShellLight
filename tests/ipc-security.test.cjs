const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createIpcSecurity } = require('../electron/ipc-security.cjs');
const page = 'file:///C:/ShellLight/dist/index.html';
function fixture() {
  const handlers = new Map();
  const ipc = createIpcSecurity({ handle: (channel, handler) => handlers.set(channel, handler) });
  const makeWindow = (id, url) => {
    const webContents = Object.assign(new EventEmitter(), { id, mainFrame: { url }, isDestroyed: () => false });
    return { webContents };
  };
  const manager = makeWindow(1, page), terminal = makeWindow(2, page + '?terminal=1');
  ipc.register(manager, 'manager', page); ipc.register(terminal, 'terminal', page + '?terminal=1');
  let writes = 0;
  ipc.handle('save', 'manager', () => ++writes);
  ipc.handle('session-input', 'terminal', (_, input) => input);
  const event = window => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  return { handlers, manager, terminal, event, makeWindow, writes: () => writes };
}
test('registered manager and terminal can use their own IPC channels', () => {
  const f = fixture();
  assert.equal(f.handlers.get('save')(f.event(f.manager)), 1);
  assert.equal(f.handlers.get('session-input')(f.event(f.terminal), 'ls\r'), 'ls\r');
});
test('terminal cannot manage settings; manager cannot control a terminal', () => {
  const f = fixture();
  assert.throws(() => f.handlers.get('save')(f.event(f.terminal)), /denied/);
  assert.throws(() => f.handlers.get('session-input')(f.event(f.manager), 'rm'), /denied/);
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
