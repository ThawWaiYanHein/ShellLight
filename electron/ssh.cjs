const path = require('node:path');
const os = require('node:os');
const AUTH = ['default', 'key', 'password', 'agent'];
function token(value, label, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
function validateConnection(c) {
  if (!c || typeof c !== 'object') throw new Error('Invalid connection.');
  token(c.name, 'connection name', /^[^\x00-\x1f]{1,100}$/);
  token(c.host, 'host or SSH alias', /^[a-zA-Z0-9][a-zA-Z0-9.:_%\-]{0,252}$/);
  if (c.username) token(c.username, 'username', /^[a-zA-Z0-9_][a-zA-Z0-9_.@\-]{0,100}$/);
  if (!Number.isInteger(Number(c.port)) || Number(c.port) < 1 || Number(c.port) > 65535) throw new Error('Port must be between 1 and 65535.');
  if (!AUTH.includes(c.auth)) throw new Error('Choose an authentication method.');
  if (c.auth === 'key' && (!c.keyPath || /[\x00-\x1f;"]/g.test(c.keyPath))) throw new Error('Select a valid private key file.');
  if (c.jumpHost) token(c.jumpHost, 'jump host (use an SSH alias or user@host:port)', /^[a-zA-Z0-9_][a-zA-Z0-9_.@:\-\[\]]{0,252}$/);
  return c;
}
function expandHome(file) { return file.startsWith('~/') || file.startsWith('~\\') ? path.join(os.homedir(), file.slice(2)) : file; }
function sshArgs(c) {
  validateConnection(c);
  const args = [];
  if (c.port !== '22' && Number(c.port) !== 22) args.push('-p', String(c.port));
  if (c.username) args.push('-l', c.username);
  if (c.auth === 'key') args.push('-i', expandHome(c.keyPath), '-o', 'IdentitiesOnly=yes', '-o', 'PreferredAuthentications=publickey');
  if (c.auth === 'password') args.push('-o', 'PubkeyAuthentication=no', '-o', 'PreferredAuthentications=keyboard-interactive,password');
  if (c.auth === 'agent') args.push('-o', 'IdentityFile=none', '-o', 'PreferredAuthentications=publickey');
  if (c.jumpHost) args.push('-J', c.jumpHost);
  return [...args, c.host];
}
function parseConfig(source) {
  const result = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*Host\s+(.+?)(?:\s+#.*)?$/i);
    if (match) for (const alias of match[1].split(/\s+/)) {
      if (/^[a-zA-Z0-9][a-zA-Z0-9._\-]*$/.test(alias)) result.push({ name: alias, host: alias, username: '', port: '22', auth: 'default', keyPath: '', jumpHost: '', favorite: false });
    }
  }
  return result;
}
module.exports = { validateConnection, sshArgs, parseConfig, expandHome };
