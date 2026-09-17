export type DeviceStatus = 'online' | 'offline' | 'connecting' | 'auth_failed' | 'outdated' | 'revoked';
export type SessionStatus = 'PENDING' | 'AUTHORIZED' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'REVOKED' | 'FAILED';
export type CommandType = 'DEVICE_PING' | 'GET_DEVICE_STATUS' | 'CREATE_ACCESS_SESSION' | 'REVOKE_ACCESS_SESSION' | 'GET_ACTIVE_SESSIONS' | 'LOCK_REQUEST' | 'HEARTBEAT';
export interface Profile {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    mfaEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface Device {
    id: string;
    ownerId: string;
    deviceName: string;
    deviceUuid: string;
    platform: string;
    hostname: string | null;
    osVersion: string | null;
    agentVersion: string;
    publicKey: string;
    publicKeyAlgorithm: string;
    lastSeen: string;
    status: DeviceStatus;
    isTrusted: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface DeviceTelemetry {
    deviceId: string;
    ipHash: string | null;
    cpuUsagePct: number | null;
    memoryUsagePct: number | null;
    batteryPct: number | null;
    isCharging: boolean | null;
    activeUser: string | null;
    workstationLocked: boolean;
    lastHeartbeat: string;
    consecutiveFailedHeartbeats: number;
    updatedAt: string;
}
export interface AccessSession {
    id: string;
    deviceId: string;
    ownerId: string;
    sessionType: string;
    status: SessionStatus;
    durationMinutes: number;
    createdAt: string;
    authorizedAt: string | null;
    activatedAt: string | null;
    expiresAt: string;
    revokedAt: string | null;
    revokedBy: string | null;
    createdBy: string;
    failureReason: string | null;
    metadata: Record<string, unknown>;
    updatedAt: string;
}
export interface AuthorizationCommand {
    id: string;
    deviceId: string;
    sessionId: string | null;
    commandType: CommandType;
    nonce: string;
    payload: Record<string, unknown>;
    signature: string | null;
    isDispatched: boolean;
    dispatchedAt: string | null;
    isAcknowledged: boolean;
    acknowledgedAt: string | null;
    resultStatus: string | null;
    resultError: string | null;
    expiresAt: string;
    createdAt: string;
}
export interface PairingRequest {
    id: string;
    ownerId: string;
    deviceName: string;
    pairingCode: string;
    expiresAt: string;
    isUsed: boolean;
    usedAt: string | null;
    createdAt: string;
}
export interface AuditLog {
    id: string;
    userId: string | null;
    deviceId: string | null;
    eventType: string;
    timestamp: string;
    ipHash?: string | null;
    userAgent?: string | null;
    success: boolean;
    reason: string | null;
    details: Record<string, unknown>;
}
export interface SecurityEvent {
    id: string;
    deviceId: string | null;
    userId: string | null;
    eventType: string;
    severity: 'info' | 'warning' | 'critical';
    details: Record<string, unknown>;
    timestamp: string;
}
export interface ApiErrorResponse {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
//# sourceMappingURL=types.d.ts.map