const { createHash } = require('node:crypto');
function account(c) {
  return createHash('sha256').update(JSON.stringify([c.id, c.host, Number(c.port), c.username])).digest('hex');
}
function entry(c) { const { Entry } = require('@napi-rs/keyring'); return new Entry('ShellLight', account(c)); }
function validateRemembered(c) {
  if (!c.rememberPassword) return;
  if (c.auth !== 'password' || !c.username || c.jumpHost) throw new Error('Remember password requires Password authentication, an explicit username, and a direct host without a jump host.');
}
module.exports = { account, validateRemembered, get: c => entry(c).getPassword(), set: (c, password) => entry(c).setPassword(password), remove: c => entry(c).deleteCredential() };
