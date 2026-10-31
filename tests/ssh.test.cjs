const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sshArgs, parseConfig, validateConnection } = require('../electron/ssh.cjs');
const base = { name: 'API', host: '10.0.0.1', username: 'ubuntu', port: '22', auth: 'default', keyPath: '', jumpHost: '' };
test('default authentication preserves SSH config defaults', () => {
  assert.deepEqual(sshArgs({ ...base, host: 'qa-alias', username: '' }), ['qa-alias']);
});
test('key file with spaces is passed as a single argument', () => {
  assert.deepEqual(sshArgs({ ...base, port: '2222', auth: 'key', keyPath: 'C:\\My Keys\\qa.pem', jumpHost: 'jumpuser@bastion:22' }), ['-p','2222','-l','ubuntu','-i','C:\\My Keys\\qa.pem','-o','IdentitiesOnly=yes','-o','PreferredAuthentications=publickey','-J','jumpuser@bastion:22','10.0.0.1']);
});
test('password mode disables public key auth', () => {
  const args = sshArgs({ ...base, auth: 'password' });
  assert.ok(args.includes('PubkeyAuthentication=no'));
  assert.ok(args.includes('PreferredAuthentications=keyboard-interactive,password'));
  assert.ok(!args.includes('-i'));
});
test('agent mode excludes identity files', () => assert.ok(sshArgs({ ...base, auth: 'agent' }).includes('IdentityFile=none')));
test('rejects command options, terminal separators, and invalid ports', () => {
  for (const field of [{ host: '-oProxyCommand=evil' }, { host: 'vm;evil' }, { username: 'user;evil' }, { jumpHost: '-oProxyCommand=evil' }, { port: 0 }, { port: 65536 }, { port: '22.5' }, { auth: 'key', keyPath: 'key;evil' }, { auth: 'unknown' }]) assert.throws(() => validateConnection({ ...base, ...field }));
});
test('SSH config import reads concrete aliases and ignores wildcard patterns', () => {
  const result = parseConfig('# SSH config\nHost staging qa # aliases\n HostName 10.0.1.2\n User ubuntu\n IdentityFile ~/.ssh/key\nHost * !excluded demo-*\nHost demo\n ProxyJump bastion');
  assert.deepEqual(result.map(c => c.host), ['staging','qa','demo']);
  assert.ok(result.every(c => c.auth === 'default' && c.username === ''));
});
