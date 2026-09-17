import { SessionStatus } from './types';
export declare class InvalidStateTransitionError extends Error {
    readonly from: SessionStatus;
    readonly to: SessionStatus;
    constructor(from: SessionStatus, to: SessionStatus);
}
/**
 * Asserts whether a transition from `currentStatus` to `nextStatus` is allowed.
 * Returns true if valid, false if invalid.
 */
export declare function isValidSessionTransition(currentStatus: SessionStatus, nextStatus: SessionStatus): boolean;
/**
 * Validates transition or throws InvalidStateTransitionError.
 */
export declare function assertValidTransition(currentStatus: SessionStatus, nextStatus: SessionStatus): void;
/**
 * Checks if a session can be manually revoked.
 * Sessions already in a terminal state cannot be revoked.
 */
export declare function isRevocable(status: SessionStatus): boolean;
/**
 * Checks if a session is currently actively granting access to the PC.
 */
export declare function isCurrentlyActive(status: SessionStatus): boolean;
/**
 * Computes state based on server time and explicit expiration date.
 * If server time exceeds expiration date, the state resolves to EXPIRED.
 * If within 5 minutes of expiration, resolves to EXPIRING.
 */
export declare function evaluateSessionTimeState(currentStatus: SessionStatus, expiresAtDate: Date, nowDate?: Date): SessionStatus;
//# sourceMappingURL=state-machine.d.ts.map