// ==============================================================================
// iLock Access Session Finite State Machine (FSM)
// Enforces strict, deterministic lifecycle transitions
// ==============================================================================

import { SessionStatus } from './types';

export class InvalidStateTransitionError extends Error {
  constructor(public readonly from: SessionStatus, public readonly to: SessionStatus) {
    super(`Invalid session transition from '${from}' to '${to}'`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Valid state transition graph for iLock access sessions.
 * Terminal states (EXPIRED, REVOKED, FAILED) have no outgoing transitions.
 */
const VALID_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  PENDING: ['AUTHORIZED', 'FAILED', 'REVOKED'],
  AUTHORIZED: ['ACTIVE', 'FAILED', 'REVOKED', 'EXPIRED'],
  ACTIVE: ['EXPIRING', 'EXPIRED', 'REVOKED', 'FAILED'],
  EXPIRING: ['EXPIRED', 'REVOKED', 'FAILED'],
  EXPIRED: [], // Terminal
  REVOKED: [], // Terminal
  FAILED: [],  // Terminal
};

/**
 * Asserts whether a transition from `currentStatus` to `nextStatus` is allowed.
 * Returns true if valid, false if invalid.
 */
export function isValidSessionTransition(
  currentStatus: SessionStatus,
  nextStatus: SessionStatus
): boolean {
  if (currentStatus === nextStatus) {
    return true; // Idempotent no-op
  }
  const allowed = VALID_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

/**
 * Validates transition or throws InvalidStateTransitionError.
 */
export function assertValidTransition(
  currentStatus: SessionStatus,
  nextStatus: SessionStatus
): void {
  if (!isValidSessionTransition(currentStatus, nextStatus)) {
    throw new InvalidStateTransitionError(currentStatus, nextStatus);
  }
}

/**
 * Checks if a session can be manually revoked.
 * Sessions already in a terminal state cannot be revoked.
 */
export function isRevocable(status: SessionStatus): boolean {
  return status === 'PENDING' || status === 'AUTHORIZED' || status === 'ACTIVE' || status === 'EXPIRING';
}

/**
 * Checks if a session is currently actively granting access to the PC.
 */
export function isCurrentlyActive(status: SessionStatus): boolean {
  return status === 'ACTIVE' || status === 'EXPIRING';
}

/**
 * Computes state based on server time and explicit expiration date.
 * If server time exceeds expiration date, the state resolves to EXPIRED.
 * If within 5 minutes of expiration, resolves to EXPIRING.
 */
export function evaluateSessionTimeState(
  currentStatus: SessionStatus,
  expiresAtDate: Date,
  nowDate: Date = new Date()
): SessionStatus {
  if (!isRevocable(currentStatus)) {
    return currentStatus;
  }

  const nowMs = nowDate.getTime();
  const expiresAtMs = expiresAtDate.getTime();

  if (nowMs >= expiresAtMs) {
    return 'EXPIRED';
  }

  const remainingMs = expiresAtMs - nowMs;
  if (remainingMs <= 5 * 60 * 1000 && currentStatus === 'ACTIVE') {
    return 'EXPIRING';
  }

  return currentStatus;
}
