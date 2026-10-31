const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { windowsTools, sshLaunchPlan } = require('../electron/windows-tools.cjs');
test('SSH, agent, terminal, and PowerShell use absolute paths', () => {
  const tools = windowsTools({ SystemRoot: 'D:\\Windows', LOCALAPPDATA: 'C:\\Users\\example\\AppData\\Local', PATH: 'C:\\untrusted' });
  for (const executable of Object.values(tools)) { assert.ok(path.win32.isAbsolute(executable)); assert.ok(!executable.includes('untrusted')); }
  assert.equal(tools.ssh, 'D:\\Windows\\System32\\OpenSSH\\ssh.exe');
  assert.equal(tools.terminal, 'C:\\Users\\example\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe');
});
test('Windows Terminal receives the absolute SSH path and unmodified arguments', () => {
  const tools = windowsTools({ SystemRoot: 'C:\\Windows', LOCALAPPDATA: 'C:\\Users\\example\\AppData\\Local' });
  const args = ['-i', 'C:\\My Keys\\server.pem', 'vm.example'];
  const plan = sshLaunchPlan(args, tools);
  assert.equal(plan.terminal.command, tools.terminal);
  assert.deepEqual(plan.terminal.args, ['-w', '0', 'new-tab', '--', tools.ssh, ...args]);
});
test('PowerShell fallback quotes the executable and each argument literally', () => {
  const tools = windowsTools({ SystemRoot: 'C:\\Windows', LOCALAPPDATA: 'C:\\Users\\example\\AppData\\Local' });
  const plan = sshLaunchPlan(['-i', "C:\\My Keys\\it's $(evil).pem", 'vm.example'], tools);
  const script = Buffer.from(plan.fallback.args.at(-1), 'base64').toString('utf16le');
  assert.equal(plan.fallback.command, tools.powershell);
  assert.equal(script, "& 'C:\\Windows\\System32\\OpenSSH\\ssh.exe' '-i' 'C:\\My Keys\\it''s $(evil).pem' 'vm.example'");
});
