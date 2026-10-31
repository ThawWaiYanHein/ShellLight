const { test } = require('node:test');
const assert = require('node:assert/strict');
const { account, validateRemembered } = require('../electron/passwords.cjs');
const base = { id: 'vm', host: 'localhost', port: '22', username: 'tester', auth: 'password', rememberPassword: true };
test('credential identity changes when destination or account changes', () => {
  for (const change of [{ id: 'copy' }, { host: 'other' }, { port: '2222' }, { username: 'root' }]) assert.notEqual(account(base), account({ ...base, ...change }));
  assert.equal(account(base), account({ ...base, name: 'Renamed' }));
});
test('saved passwords require a direct destination and explicit username', () => {
  assert.doesNotThrow(() => validateRemembered(base));
  for (const change of [{ username: '' }, { auth: 'key' }, { jumpHost: 'bastion' }]) assert.throws(() => validateRemembered({ ...base, ...change }));
  assert.doesNotThrow(() => validateRemembered({ ...base, rememberPassword: false, username: '' }));
});
