const { Client } = require('ssh2');
function connectPassword(c, password, hostVerifier, events) {
  const client = new Client();
  let stream;
  client.on('ready', () => {
    password = undefined;
    client.shell({ term: 'xterm-256color', cols: 100, rows: 30 }, (err, channel) => {
      if (err) { events.error(err.message); client.end(); return; }
      stream = channel;
      events.ready();
      channel.on('data', data => events.data(data));
      channel.stderr.on('data', data => events.data(data));
      channel.on('close', () => client.end());
    });
  });
  client.on('error', err => { password = undefined; events.error(err.level === 'client-authentication' ? 'Login failed. Edit this connection to replace the saved password.' : err.message); });
  client.on('close', () => { password = undefined; events.close(); });
  client.connect({ host: c.host, port: Number(c.port), username: c.username, password, hostHash: 'sha256', hostVerifier, readyTimeout: 120000, keepaliveInterval: 15000 });
  return {
    input: data => stream?.write(data),
    resize: (cols, rows) => stream?.setWindow(rows, cols, 0, 0),
    close: () => client.destroy(),
  };
}
module.exports = { connectPassword };
