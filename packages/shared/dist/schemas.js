"use strict";
// ==============================================================================
// iLock Validation Schemas (Zod)
// Strict typing for API boundaries & Agent commands
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandResultSchema = exports.AgentChallengeRequestSchema = exports.AgentHeartbeatSchema = exports.LockDeviceSchema = exports.RevokeAccessSessionSchema = exports.CreateAccessSessionSchema = exports.RegisterDeviceSchema = exports.CreatePairingRequestSchema = exports.PairingCodeRegex = void 0;
const zod_1 = require("zod");
exports.PairingCodeRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}$|^[A-Z0-9]{8}$/;
// Device Pairing Initiation Schema (Web Client -> API)
exports.CreatePairingRequestSchema = zod_1.z.object({
    deviceName: zod_1.z
        .string()
        .min(2, 'Device name must be at least 2 characters')
        .max(64, 'Device name cannot exceed 64 characters')
        .trim(),
});
// Device Registration Schema (Windows Agent -> API)
exports.RegisterDeviceSchema = zod_1.z.object({
    pairingCode: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .refine((val) => exports.PairingCodeRegex.test(val.replace(/\s+/g, '')), {
        message: 'Invalid pairing code format. Expected 8 alphanumeric characters.',
    }),
    deviceUuid: zod_1.z
        .string()
        .uuid('Device UUID must be a valid UUID v4')
        .or(zod_1.z.string().min(8).max(64)),
    hostname: zod_1.z.string().min(1).max(128),
    osVersion: zod_1.z.string().max(256).optional().default('Windows'),
    agentVersion: zod_1.z.string().max(32).default('1.0.0'),
    publicKey: zod_1.z
        .string()
        .min(64, 'Public key is invalid or too short')
        .refine((val) => val.includes('PUBLIC KEY') || val.length >= 64, {
        message: 'Invalid public key format',
    }),
    publicKeyAlgorithm: zod_1.z.enum(['RSA-4096', 'ECDSA-P256']).default('RSA-4096'),
});
// Temporary Access Creation Schema (Web Client -> API)
exports.CreateAccessSessionSchema = zod_1.z.object({
    deviceId: zod_1.z.string().uuid('Invalid device ID'),
    durationMinutes: zod_1.z
        .number()
        .int('Duration must be an integer')
        .min(1, 'Minimum duration is 1 minute')
        .max(1440, 'Maximum duration is 24 hours (1440 minutes)'),
    sessionType: zod_1.z.string().default('temporary_access'),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional().default({}),
});
// Session Revocation Schema (Web Client -> API)
exports.RevokeAccessSessionSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid('Invalid session ID'),
    reason: zod_1.z.string().max(256).optional().default('Owner manual revocation'),
});
// Device Lock Request Schema
exports.LockDeviceSchema = zod_1.z.object({
    deviceId: zod_1.z.string().uuid('Invalid device ID'),
});
// Agent Heartbeat Schema (Windows Agent -> API)
exports.AgentHeartbeatSchema = zod_1.z.object({
    deviceUuid: zod_1.z.string().min(8).max(64),
    timestamp: zod_1.z.number().int().positive('Timestamp must be positive UTC milliseconds'),
    nonce: zod_1.z.string().min(16).max(128),
    signature: zod_1.z.string().min(16, 'Signature required for authenticity'),
    cpuUsagePct: zod_1.z.number().min(0).max(100).optional(),
    memoryUsagePct: zod_1.z.number().min(0).max(100).optional(),
    batteryPct: zod_1.z.number().min(0).max(100).optional(),
    isCharging: zod_1.z.boolean().optional(),
    activeUser: zod_1.z.string().max(128).optional(),
    workstationLocked: zod_1.z.boolean().default(true),
});
// Agent Challenge Request Schema (Windows Agent -> API)
exports.AgentChallengeRequestSchema = zod_1.z.object({
    deviceUuid: zod_1.z.string().min(8).max(64),
});
// Agent Command Result Schema (Windows Agent -> API)
exports.CommandResultSchema = zod_1.z.object({
    commandId: zod_1.z.string().uuid('Invalid command ID'),
    sessionId: zod_1.z.string().uuid('Invalid session ID').optional().nullable(),
    status: zod_1.z.enum(['SUCCESS', 'FAILED', 'REJECTED']),
    resultStatus: zod_1.z.string().max(64).optional(),
    error: zod_1.z.string().max(512).optional().nullable(),
    nonce: zod_1.z.string().min(16).max(128),
    timestamp: zod_1.z.number().int().positive(),
    signature: zod_1.z.string().min(16),
});
//# sourceMappingURL=schemas.js.map