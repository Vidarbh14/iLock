import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteInputSchema } from '../packages/shared/dist/schemas.js';
// Node >= 22.18 / 23.6 strips TypeScript types natively
import { buildRemoteInputCommandPayload } from '../apps/web/lib/remote-input.ts';

const build = (body) => buildRemoteInputCommandPayload(RemoteInputSchema.parse(body));

test('--- REMOTE INPUT COMMAND PAYLOAD (phone -> agent routing) ---', async (t) => {
  await t.test('1. Routing key always stays REMOTE_INPUT, even when the phone sends action', () => {
    for (const body of [
      { action: 'click', x: 0.5, y: 0.5 },
      { action: 'keystrokes', text: 'hi' },
      { action: 'macro', macro: 'ALT_F4' },
      { type: 'scroll', deltaY: -120 },
    ]) {
      assert.equal(build(body).action, 'REMOTE_INPUT', JSON.stringify(body));
    }
  });

  await t.test('2. Input kind travels in type, matching the agent InputSimulator cases', () => {
    const click = build({ action: 'click', x: 0.25, y: 0.75, button: 'right' });
    assert.equal(click.type, 'click');
    assert.equal(click.x, 0.25);
    assert.equal(click.button, 'right');

    // InputSimulator handles "keystroke"; the phone sends "keystrokes"
    const typed = build({ action: 'keystrokes', text: 'Hello iLock' });
    assert.equal(typed.type, 'keystroke');
    assert.equal(typed.text, 'Hello iLock');

    const macro = build({ action: 'macro', macro: 'TASK_MGR' });
    assert.equal(macro.type, 'macro');
    assert.equal(macro.macro, 'TASK_MGR');
  });

  await t.test('3. Explicit type wins over action', () => {
    assert.equal(build({ type: 'move', action: 'click', x: 0.1, y: 0.1 }).type, 'move');
  });
});
