"use strict";
// ==============================================================================
// iLock Access Session Finite State Machine (FSM)
// Enforces strict, deterministic lifecycle transitions
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidStateTransitionError = void 0;
exports.isValidSessionTransition = isValidSessionTransition;
exports.assertValidTransition = assertValidTransition;
exports.isRevocable = isRevocable;
exports.isCurrentlyActive = isCurrentlyActive;
exports.evaluateSessionTimeState = evaluateSessionTimeState;
class InvalidStateTransitionError extends Error {
    from;
    to;
    constructor(from, to) {
        super(`Invalid session transition from '${from}' to '${to}'`);
        this.from = from;
        this.to = to;
        this.name = 'InvalidStateTransitionError';
    }
}
exports.InvalidStateTransitionError = InvalidStateTransitionError;
/**
 * Valid state transition graph for iLock access sessions.
 * Terminal states (EXPIRED, REVOKED, FAILED) have no outgoing transitions.
 */
const VALID_TRANSITIONS = {
    PENDING: ['AUTHORIZED', 'FAILED', 'REVOKED'],
    AUTHORIZED: ['ACTIVE', 'FAILED', 'REVOKED', 'EXPIRED'],
    ACTIVE: ['EXPIRING', 'EXPIRED', 'REVOKED', 'FAILED'],
    EXPIRING: ['EXPIRED', 'REVOKED', 'FAILED'],
    EXPIRED: [], // Terminal
    REVOKED: [], // Terminal
    FAILED: [], // Terminal
};
/**
 * Asserts whether a transition from `currentStatus` to `nextStatus` is allowed.
 * Returns true if valid, false if invalid.
 */
function isValidSessionTransition(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) {
        return true; // Idempotent no-op
    }
    const allowed = VALID_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(nextStatus) : false;
}
/**
 * Validates transition or throws InvalidStateTransitionError.
 */
function assertValidTransition(currentStatus, nextStatus) {
    if (!isValidSessionTransition(currentStatus, nextStatus)) {
        throw new InvalidStateTransitionError(currentStatus, nextStatus);
    }
}
/**
 * Checks if a session can be manually revoked.
 * Sessions already in a terminal state cannot be revoked.
 */
function isRevocable(status) {
    return status === 'PENDING' || status === 'AUTHORIZED' || status === 'ACTIVE' || status === 'EXPIRING';
}
/**
 * Checks if a session is currently actively granting access to the PC.
 */
function isCurrentlyActive(status) {
    return status === 'ACTIVE' || status === 'EXPIRING';
}
/**
 * Computes state based on server time and explicit expiration date.
 * If server time exceeds expiration date, the state resolves to EXPIRED.
 * If within 5 minutes of expiration, resolves to EXPIRING.
 */
function evaluateSessionTimeState(currentStatus, expiresAtDate, nowDate = new Date()) {
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
//# sourceMappingURL=state-machine.js.map