const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function preload(file) {
  let api;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../electron', file), 'utf8'), {
    require: module => { assert.equal(module, 'electron'); return { contextBridge: { exposeInMainWorld: (name, exposed) => { assert.equal(name, 'shelllight'); api = exposed; } }, ipcRenderer: {} }; },
  });
  return Object.keys(api).sort();
}
test('management preload exposes local session controls alongside the manager API', () => {
  assert.deepEqual(preload('preload.cjs'), ['agentStatus', 'connect', 'importSSH', 'load', 'onSession', 'openVSCode', 'pickKey', 'save', 'sessionClose', 'sessionCopy', 'sessionInput', 'sessionOutputAck', 'sessionPaste', 'sessionResize', 'sessionStart', 'setupAgent', 'unlockKey']);
});
