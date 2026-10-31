const { test } = require('node:test');
const assert = require('node:assert/strict');
const { unlockScript, windowScript } = require('../electron/agent.cjs');
test('unlock safely quotes spaces and PowerShell metacharacters', () => {
  const script = unlockScript("C:\\My Keys\\it's $(evil); key.pem");
  assert.ok(script.includes("'C:\\My Keys\\it''s $(evil); key.pem'"));
  assert.ok(script.includes('$result = $LASTEXITCODE'));
});
test('unlock rejects invalid input before starting any process', () => {
  for (const value of [null, undefined, '', '  ', 'key\nfile']) assert.throws(() => unlockScript(value));
});
test('only fixed agent setup runs elevated; key unlock uses normal account', () => {
  const unlock = windowScript(unlockScript('C:\\keys\\qa.pem'), false);
  assert.ok(!unlock.includes('-Verb RunAs'));
  assert.ok(unlock.includes('-WindowStyle Normal'));
  assert.ok(windowScript('exit 0', true).includes('-Verb RunAs -WindowStyle Hidden'));
  assert.ok(!unlock.includes('qa.pem'));
});
