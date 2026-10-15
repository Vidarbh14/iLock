import { z } from 'zod';
export declare const PairingCodeRegex: RegExp;
export declare const CreatePairingRequestSchema: z.ZodObject<{
    deviceName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceName: string;
}, {
    deviceName: string;
}>;
export type CreatePairingRequestInput = z.infer<typeof CreatePairingRequestSchema>;
export declare const RegisterDeviceSchema: z.ZodObject<{
    pairingCode: z.ZodEffects<z.ZodString, string, string>;
    deviceUuid: z.ZodUnion<[z.ZodString, z.ZodString]>;
    hostname: z.ZodString;
    osVersion: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    agentVersion: z.ZodDefault<z.ZodString>;
    publicKey: z.ZodEffects<z.ZodString, string, string>;
    publicKeyAlgorithm: z.ZodDefault<z.ZodEnum<["RSA-4096", "ECDSA-P256"]>>;
}, "strip", z.ZodTypeAny, {
    pairingCode: string;
    deviceUuid: string;
    hostname: string;
    osVersion: string;
    agentVersion: string;
    publicKey: string;
    publicKeyAlgorithm: "RSA-4096" | "ECDSA-P256";
}, {
    pairingCode: string;
    deviceUuid: string;
    hostname: string;
    publicKey: string;
    osVersion?: string | undefined;
    agentVersion?: string | undefined;
    publicKeyAlgorithm?: "RSA-4096" | "ECDSA-P256" | undefined;
}>;
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;
export declare const CreateAccessSessionSchema: z.ZodObject<{
    deviceId: z.ZodString;
    durationMinutes: z.ZodNumber;
    sessionType: z.ZodDefault<z.ZodString>;
    metadata: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    durationMinutes: number;
    sessionType: string;
    metadata: Record<string, unknown>;
}, {
    deviceId: string;
    durationMinutes: number;
    sessionType?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export type CreateAccessSessionInput = z.infer<typeof CreateAccessSessionSchema>;
export declare const RevokeAccessSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    reason: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    reason: string;
}, {
    sessionId: string;
    reason?: string | undefined;
}>;
export type RevokeAccessSessionInput = z.infer<typeof RevokeAccessSessionSchema>;
export declare const LockDeviceSchema: z.ZodObject<{
    deviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
}, {
    deviceId: string;
}>;
export type LockDeviceInput = z.infer<typeof LockDeviceSchema>;
export declare const UnlockDeviceSchema: z.ZodObject<{
    deviceId: z.ZodString;
    biometricVerified: z.ZodDefault<z.ZodBoolean>;
    authChallenge: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    biometricVerified: boolean;
    authChallenge?: string | undefined;
}, {
    deviceId: string;
    biometricVerified?: boolean | undefined;
    authChallenge?: string | undefined;
}>;
export type UnlockDeviceInput = z.infer<typeof UnlockDeviceSchema>;
export declare const AgentHeartbeatSchema: z.ZodObject<{
    deviceUuid: z.ZodString;
    timestamp: z.ZodNumber;
    nonce: z.ZodString;
    signature: z.ZodString;
    cpuUsagePct: z.ZodOptional<z.ZodNumber>;
    memoryUsagePct: z.ZodOptional<z.ZodNumber>;
    batteryPct: z.ZodOptional<z.ZodNumber>;
    isCharging: z.ZodOptional<z.ZodBoolean>;
    activeUser: z.ZodOptional<z.ZodString>;
    workstationLocked: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    deviceUuid: string;
    timestamp: number;
    nonce: string;
    signature: string;
    workstationLocked: boolean;
    cpuUsagePct?: number | undefined;
    memoryUsagePct?: number | undefined;
    batteryPct?: number | undefined;
    isCharging?: boolean | undefined;
    activeUser?: string | undefined;
}, {
    deviceUuid: string;
    timestamp: number;
    nonce: string;
    signature: string;
    cpuUsagePct?: number | undefined;
    memoryUsagePct?: number | undefined;
    batteryPct?: number | undefined;
    isCharging?: boolean | undefined;
    activeUser?: string | undefined;
    workstationLocked?: boolean | undefined;
}>;
export type AgentHeartbeatInput = z.infer<typeof AgentHeartbeatSchema>;
export declare const AgentChallengeRequestSchema: z.ZodObject<{
    deviceUuid: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceUuid: string;
}, {
    deviceUuid: string;
}>;
export type AgentChallengeRequestInput = z.infer<typeof AgentChallengeRequestSchema>;
export declare const CommandResultSchema: z.ZodObject<{
    commandId: z.ZodString;
    sessionId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodEnum<["SUCCESS", "FAILED", "REJECTED"]>;
    resultStatus: z.ZodOptional<z.ZodString>;
    error: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    nonce: z.ZodString;
    timestamp: z.ZodNumber;
    signature: z.ZodString;
    data: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "FAILED" | "REJECTED" | "SUCCESS";
    timestamp: number;
    nonce: string;
    signature: string;
    commandId: string;
    sessionId?: string | null | undefined;
    resultStatus?: string | undefined;
    error?: string | null | undefined;
    data?: string | null | undefined;
}, {
    status: "FAILED" | "REJECTED" | "SUCCESS";
    timestamp: number;
    nonce: string;
    signature: string;
    commandId: string;
    sessionId?: string | null | undefined;
    resultStatus?: string | undefined;
    error?: string | null | undefined;
    data?: string | null | undefined;
}>;
export type CommandResultInput = z.infer<typeof CommandResultSchema>;
export declare const PowerCommandSchema: z.ZodObject<{
    action: z.ZodEnum<["sleep", "restart", "display_off", "stealth_lock", "alarm"]>;
}, "strip", z.ZodTypeAny, {
    action: "sleep" | "restart" | "display_off" | "stealth_lock" | "alarm";
}, {
    action: "sleep" | "restart" | "display_off" | "stealth_lock" | "alarm";
}>;
export type PowerCommandInput = z.infer<typeof PowerCommandSchema>;
export declare const ToastMessageSchema: z.ZodObject<{
    message: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    title?: string | undefined;
}, {
    message: string;
    title?: string | undefined;
}>;
export type ToastMessageInput = z.infer<typeof ToastMessageSchema>;
export declare const ClipboardPushSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
export type ClipboardPushInput = z.infer<typeof ClipboardPushSchema>;
export declare const GuestRequestCreateSchema: z.ZodObject<{
    deviceId: z.ZodString;
    guestName: z.ZodString;
    requestedMinutes: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    guestName: string;
    requestedMinutes: number;
    reason?: string | undefined;
}, {
    deviceId: string;
    guestName: string;
    requestedMinutes: number;
    reason?: string | undefined;
}>;
export type GuestRequestCreateInput = z.infer<typeof GuestRequestCreateSchema>;
export declare const StartScreenStreamSchema: z.ZodObject<{
    quality: z.ZodDefault<z.ZodEnum<["performance", "balanced", "high"]>>;
    targetFps: z.ZodDefault<z.ZodNumber>;
    streamSessionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    quality: "performance" | "balanced" | "high";
    targetFps: number;
    streamSessionId?: string | undefined;
}, {
    quality?: "performance" | "balanced" | "high" | undefined;
    targetFps?: number | undefined;
    streamSessionId?: string | undefined;
}>;
export type StartScreenStreamInput = z.infer<typeof StartScreenStreamSchema>;
//# sourceMappingURL=schemas.d.ts.map