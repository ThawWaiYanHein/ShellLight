// Only a registered window's current top-level application document may use IPC.
function createIpcSecurity(ipcMain) {
  const windows = new Map();
  function register(window, role, url) {
    const contents = window.webContents;
    windows.set(contents.id, { contents, role, url });
    contents.once('destroyed', () => windows.delete(contents.id));
  }
  function authorized(event, role) {
    const sender = event.sender;
    const registered = sender && windows.get(sender.id);
    return !!(registered && registered.contents === sender && !sender.isDestroyed()
      && registered.role === role && event.senderFrame
      && event.senderFrame === sender.mainFrame && event.senderFrame.url === registered.url);
  }
  function handle(channel, role, handler) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!authorized(event, role)) throw new Error('IPC access denied.');
      return handler(event, ...args);
    });
  }
  function listen(channel, role, listener) {
    ipcMain.on(channel, (event, ...args) => {
      if (authorized(event, role)) listener(event, ...args);
    });
  }
  return { register, handle, listen };
}
module.exports = { createIpcSecurity };
