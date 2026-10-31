const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { Server } = require('ssh2');
const { connectPassword } = require('../electron/password-session.cjs');
const key = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
async function server(t) {
  const clients = new Set();
  const server = new Server({ hostKeys: [key] }, client => {
    clients.add(client); client.on('error', () => {}); client.on('close', () => clients.delete(client));
    client.on('authentication', ctx => ctx.method === 'password' && ctx.username === 'tester' && ctx.password === 'test-secret' ? ctx.accept() : ctx.reject());
    client.on('ready', () => client.on('session', accept => {
      const session = accept(); session.on('pty', accept => accept()); session.on('window-change', accept => accept?.());
      session.on('shell', accept => { const stream = accept(); stream.write('hello-test'); stream.on('data', data => stream.write(data)); });
    }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { for (const client of clients) client.end(); server.close(); });
  return { host: '127.0.0.1', port: server.address().port, username: 'tester' };
}
test('password session verifies host and supports interactive terminal IO', { timeout: 10000 }, async t => {
  const c = await server(t); let verified = false; let session;
  await new Promise((resolve, reject) => {
    session = connectPassword(c, 'test-secret', (hash, done) => { verified = /^[a-f0-9]{64}$/.test(hash); done(true); }, {
      ready: () => { session.resize(110, 40); session.input('typed-test'); },
      data: data => { if (data.toString().includes('typed-test')) resolve(); }, error: reject, close: () => {},
    });
    t.after(() => session.close());
  });
  assert.ok(verified);
});
test('wrong saved password produces an actionable error', { timeout: 10000 }, async t => {
  const c = await server(t);
  const error = await new Promise(resolve => {
    const session = connectPassword(c, 'wrong', (_, done) => done(true), { ready: () => assert.fail('must not authenticate'), data: () => {}, error: resolve, close: () => {} });
    t.after(() => session.close());
  });
  assert.match(error, /replace the saved password/);
});
test('untrusted host is rejected before authentication', { timeout: 10000 }, async t => {
  const c = await server(t);
  const error = await new Promise(resolve => {
    const session = connectPassword(c, 'test-secret', (_, done) => done(false), { ready: () => assert.fail('must not authenticate'), data: () => {}, error: resolve, close: () => {} });
    t.after(() => session.close());
  });
  assert.match(error, /Host denied/i);
});
