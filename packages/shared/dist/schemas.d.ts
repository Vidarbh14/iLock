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
    latitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    longitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    locationAccuracyM: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    locationFixedAt: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
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
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    locationAccuracyM?: number | null | undefined;
    locationFixedAt?: number | null | undefined;
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
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    locationAccuracyM?: number | null | undefined;
    locationFixedAt?: number | null | undefined;
}>;
export type AgentHeartbeatInput = z.infer<typeof AgentHeartbeatSchema>;
export declare const LocationLiveSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    durationSeconds: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    durationSeconds: number;
}, {
    enabled: boolean;
    durationSeconds?: number | undefined;
}>;
export type LocationLiveInput = z.infer<typeof LocationLiveSchema>;
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
export declare const RemoteInputSchema: z.ZodEffects<z.ZodObject<{
    action: z.ZodOptional<z.ZodEnum<["click", "move", "scroll", "keystroke", "keystrokes", "macro"]>>;
    type: z.ZodOptional<z.ZodEnum<["click", "move", "scroll", "keystroke", "keystrokes", "macro"]>>;
    button: z.ZodDefault<z.ZodOptional<z.ZodEnum<["left", "right", "middle", "double"]>>>;
    x: z.ZodOptional<z.ZodNumber>;
    y: z.ZodOptional<z.ZodNumber>;
    deltaY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    key: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    macro: z.ZodOptional<z.ZodEnum<["ALT_F4", "WIN_D", "TASK_MGR", "LOCK", "ENTER", "ESC"]>>;
}, "strip", z.ZodTypeAny, {
    button: "left" | "right" | "middle" | "double";
    deltaY: number;
    type?: "click" | "move" | "scroll" | "keystroke" | "keystrokes" | "macro" | undefined;
    action?: "click" | "move" | "scroll" | "keystroke" | "keystrokes" | "macro" | undefined;
    text?: string | undefined;
    macro?: "ALT_F4" | "WIN_D" | "TASK_MGR" | "LOCK" | "ENTER" | "ESC" | undefined;
    x?: number | undefined;
    y?: number | undefined;
    key?: string | undefined;
}, {
    type?: "click" | "move" | "scroll" | "keystroke" | "keystrokes" | "macro" | undefined;
    action?: "click" | "move" | "scroll" | "keystroke" | "keystrokes" | "macro" | undefined;
    text?: string | undefined;
    macro?: "ALT_F4" | "WIN_D" | "TASK_MGR" | "LOCK" | "ENTER" | "ESC" | undefined;
    button?: "left" | "right" | "middle" | "double" | undefined;
    x?: number | undefined;
    y?: number | undefined;
    deltaY?: number | undefined;
    key?: string | undefined;
}>, {
    button: "left" | "right" | "middle" | "double";
    deltaY: number;
    type?: "click" | "move" | "scroll" | "keystroke" | "keystrokes" | "macro" | undefined;
    action?: "click" | "move" | "scroll" | "keystroke" | "keystrokes" | "macro" | undefined;
    text?: string | undefined;
    macro?: "ALT_F4" | "WIN_D" | "TASK_MGR" | "LOCK" | "ENTER" | "ESC" | undefined;
    x?: number | undefined;
    y?: number | undefined;
    key?: string | undefined;
}, {
    type?: "click" | "move" | "scroll" | "keystroke" | "keystrokes" | "macro" | undefined;
    action?: "click" | "move" | "scroll" | "keystroke" | "keystrokes" | "macro" | undefined;
    text?: string | undefined;
    macro?: "ALT_F4" | "WIN_D" | "TASK_MGR" | "LOCK" | "ENTER" | "ESC" | undefined;
    button?: "left" | "right" | "middle" | "double" | undefined;
    x?: number | undefined;
    y?: number | undefined;
    deltaY?: number | undefined;
    key?: string | undefined;
}>;
export type RemoteInputPayload = z.infer<typeof RemoteInputSchema>;
export declare const SpeechBroadcastSchema: z.ZodObject<{
    text: z.ZodString;
    rate: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    volume: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    text: string;
    rate: number;
    volume: number;
}, {
    text: string;
    rate?: number | undefined;
    volume?: number | undefined;
}>;
export type SpeechBroadcastInput = z.infer<typeof SpeechBroadcastSchema>;
export declare const ProcessActionSchema: z.ZodObject<{
    action: z.ZodEnum<["list", "kill"]>;
    pid: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "list" | "kill";
    pid?: number | undefined;
}, {
    action: "list" | "kill";
    pid?: number | undefined;
}>;
export type ProcessActionInput = z.infer<typeof ProcessActionSchema>;
export declare const SentryConfigSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    alarmOnTamper: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    snapOnFailedLogon: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    alertOnPowerDisconnect: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    alarmOnTamper: boolean;
    snapOnFailedLogon: boolean;
    alertOnPowerDisconnect: boolean;
}, {
    enabled: boolean;
    alarmOnTamper?: boolean | undefined;
    snapOnFailedLogon?: boolean | undefined;
    alertOnPowerDisconnect?: boolean | undefined;
}>;
export type SentryConfigInput = z.infer<typeof SentryConfigSchema>;
export declare const FileConduitSchema: z.ZodObject<{
    action: z.ZodEnum<["list", "read", "write", "delete"]>;
    folder: z.ZodDefault<z.ZodEnum<["desktop", "documents", "downloads"]>>;
    fileName: z.ZodOptional<z.ZodString>;
    contentBase64: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "list" | "read" | "write" | "delete";
    folder: "desktop" | "documents" | "downloads";
    fileName?: string | undefined;
    contentBase64?: string | undefined;
}, {
    action: "list" | "read" | "write" | "delete";
    folder?: "desktop" | "documents" | "downloads" | undefined;
    fileName?: string | undefined;
    contentBase64?: string | undefined;
}>;
export type FileConduitInput = z.infer<typeof FileConduitSchema>;
export declare const BleProximitySchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    deviceAddress: z.ZodOptional<z.ZodString>;
    rssiThreshold: z.ZodDefault<z.ZodNumber>;
    timeoutSeconds: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    rssiThreshold: number;
    timeoutSeconds: number;
    deviceAddress?: string | undefined;
}, {
    enabled: boolean;
    deviceAddress?: string | undefined;
    rssiThreshold?: number | undefined;
    timeoutSeconds?: number | undefined;
}>;
export type BleProximityInput = z.infer<typeof BleProximitySchema>;
export declare const WebPushSubscriptionSchema: z.ZodObject<{
    endpoint: z.ZodString;
    keys: z.ZodObject<{
        p256dh: z.ZodString;
        auth: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        p256dh: string;
        auth: string;
    }, {
        p256dh: string;
        auth: string;
    }>;
}, "strip", z.ZodTypeAny, {
    keys: {
        p256dh: string;
        auth: string;
    };
    endpoint: string;
}, {
    keys: {
        p256dh: string;
        auth: string;
    };
    endpoint: string;
}>;
export type WebPushSubscriptionInput = z.infer<typeof WebPushSubscriptionSchema>;
//# sourceMappingURL=schemas.d.ts.map