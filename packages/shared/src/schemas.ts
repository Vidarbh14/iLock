// ==============================================================================
// iLock Validation Schemas (Zod)
// Strict typing for API boundaries & Agent commands
// ==============================================================================

import { z } from 'zod';

export const PairingCodeRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}$|^[A-Z0-9]{8}$/;

// Device Pairing Initiation Schema (Web Client -> API)
export const CreatePairingRequestSchema = z.object({
  deviceName: z
    .string()
    .min(2, 'Device name must be at least 2 characters')
    .max(64, 'Device name cannot exceed 64 characters')
    .trim(),
});
export type CreatePairingRequestInput = z.infer<typeof CreatePairingRequestSchema>;

// Device Registration Schema (Windows Agent -> API)
export const RegisterDeviceSchema = z.object({
  pairingCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => PairingCodeRegex.test(val.replace(/\s+/g, '')), {
      message: 'Invalid pairing code format. Expected 8 alphanumeric characters.',
    }),
  deviceUuid: z
    .string()
    .uuid('Device UUID must be a valid UUID v4')
    .or(z.string().min(8).max(64)),
  hostname: z.string().min(1).max(128),
  osVersion: z.string().max(256).optional().default('Windows'),
  agentVersion: z.string().max(32).default('1.0.0'),
  publicKey: z
    .string()
    .min(64, 'Public key is invalid or too short')
    .refine((val) => val.includes('PUBLIC KEY') || val.length >= 64, {
      message: 'Invalid public key format',
    }),
  publicKeyAlgorithm: z.enum(['RSA-4096', 'ECDSA-P256']).default('RSA-4096'),
});
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;

// Temporary Access Creation Schema (Web Client -> API)
export const CreateAccessSessionSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  durationMinutes: z
    .number()
    .int('Duration must be an integer')
    .min(1, 'Minimum duration is 1 minute')
    .max(1440, 'Maximum duration is 24 hours (1440 minutes)'),
  sessionType: z.string().default('temporary_access'),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type CreateAccessSessionInput = z.infer<typeof CreateAccessSessionSchema>;

// Session Revocation Schema (Web Client -> API)
export const RevokeAccessSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  reason: z.string().max(256).optional().default('Owner manual revocation'),
});
export type RevokeAccessSessionInput = z.infer<typeof RevokeAccessSessionSchema>;

// Device Lock Request Schema
export const LockDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
});
export type LockDeviceInput = z.infer<typeof LockDeviceSchema>;

// Device Unlock Request Schema (with Biometric Verification)
export const UnlockDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  biometricVerified: z.boolean().default(false),
  authChallenge: z.string().optional(),
});
export type UnlockDeviceInput = z.infer<typeof UnlockDeviceSchema>;

// Agent Heartbeat Schema (Windows Agent -> API)
export const AgentHeartbeatSchema = z.object({
  deviceUuid: z.string().min(8).max(64),
  timestamp: z.number().int().positive('Timestamp must be positive UTC milliseconds'),
  nonce: z.string().min(16).max(128),
  signature: z.string().min(16, 'Signature required for authenticity'),
  cpuUsagePct: z.number().min(0).max(100).optional(),
  memoryUsagePct: z.number().min(0).max(100).optional(),
  batteryPct: z.number().min(0).max(100).optional(),
  isCharging: z.boolean().optional(),
  activeUser: z.string().max(2048).optional(),
  workstationLocked: z.boolean().default(true),
});
export type AgentHeartbeatInput = z.infer<typeof AgentHeartbeatSchema>;

// Agent Challenge Request Schema (Windows Agent -> API)
export const AgentChallengeRequestSchema = z.object({
  deviceUuid: z.string().min(8).max(64),
});
export type AgentChallengeRequestInput = z.infer<typeof AgentChallengeRequestSchema>;

// Agent Command Result Schema (Windows Agent -> API)
export const CommandResultSchema = z.object({
  commandId: z.string().uuid('Invalid command ID'),
  sessionId: z.string().uuid('Invalid session ID').optional().nullable(),
  status: z.enum(['SUCCESS', 'FAILED', 'REJECTED']),
  resultStatus: z.string().max(64).optional(),
  error: z.string().max(512).optional().nullable(),
  nonce: z.string().min(16).max(128),
  timestamp: z.number().int().positive(),
  signature: z.string().min(16),
});
export type CommandResultInput = z.infer<typeof CommandResultSchema>;
