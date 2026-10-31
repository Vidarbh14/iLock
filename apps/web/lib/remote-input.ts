import type { RemoteInputPayload } from '@ilock/shared';

/**
 * Builds the agent command payload for a remote input event.
 * `action` must stay 'REMOTE_INPUT' because the agent routes commands by payload.action;
 * the input kind travels in `type` (spreading the client's `action: 'click'` over it broke all input).
 * The agent's InputSimulator names typed text 'keystroke'.
 */
export function buildRemoteInputCommandPayload(input: RemoteInputPayload) {
  const { action: inputAction, type: inputType, ...inputFields } = input;
  const kind = inputType ?? inputAction;
  return {
    ...inputFields,
    type: kind === 'keystrokes' ? 'keystroke' : kind,
    action: 'REMOTE_INPUT' as const,
  };
}
