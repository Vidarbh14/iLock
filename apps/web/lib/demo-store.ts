// ==============================================================================
// iLock Safe In-Memory Demo & Development Data Store
// Enables complete end-to-end simulation of phone -> cloud -> PC agent
// without requiring live Supabase credentials or compromising Windows security.
// ==============================================================================

import type {
  AccessSession,
  AuditLog,
  AuthorizationCommand,
  Device,
  DeviceTelemetry,
  PairingRequest,
  SecurityEvent,
} from '@ilock/shared';
import {
  evaluateSessionTimeState,
  isValidSessionTransition,
} from '@ilock/shared';
import crypto from 'node:crypto';

export const DEMO_USER_ID = 'a0000000-0000-0000-0000-000000000001';
export const DEMO_DEVICE_OMEN_ID = 'b0000000-0000-0000-0000-000000000001';
export const DEMO_DEVICE_THINKPAD_ID = 'b0000000-0000-0000-0000-000000000002';

class DemoStore {
  public devices: Device[] = [
    {
      id: DEMO_DEVICE_OMEN_ID,
      ownerId: DEMO_USER_ID,
      deviceName: "Vidarbh's OMEN 16",
      deviceUuid: 'omen-16-win11-prod-001',
      platform: 'windows',
      hostname: 'OMEN-16-PRO',
      osVersion: 'Windows 11 Pro 23H2 (Build 22631.3007)',
      agentVersion: '1.2.0',
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyN6K71DemoPublicKey\n-----END PUBLIC KEY-----',
      publicKeyAlgorithm: 'RSA-4096',
      lastSeen: new Date().toISOString(),
      status: 'online',
      isTrusted: true,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: DEMO_DEVICE_THINKPAD_ID,
      ownerId: DEMO_USER_ID,
      deviceName: 'Workstation ThinkPad X1',
      deviceUuid: 'thinkpad-x1-win11-002',
      platform: 'windows',
      hostname: 'THINKPAD-X1',
      osVersion: 'Windows 11 Enterprise 22H2',
      agentVersion: '1.1.8',
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzXDemoKey2\n-----END PUBLIC KEY-----',
      publicKeyAlgorithm: 'RSA-4096',
      lastSeen: new Date(Date.now() - 2 * 3600000).toISOString(),
      status: 'offline',
      isTrusted: true,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
  ];

  public telemetry: Map<string, DeviceTelemetry> = new Map([
    [
      DEMO_DEVICE_OMEN_ID,
      {
        deviceId: DEMO_DEVICE_OMEN_ID,
        ipHash: 'a8f3b92c10ef87a4',
        cpuUsagePct: 14.2,
        memoryUsagePct: 46.8,
        batteryPct: 88.0,
        isCharging: true,
        activeUser: 'vidarbh',
        workstationLocked: true,
        lastHeartbeat: new Date().toISOString(),
        consecutiveFailedHeartbeats: 0,
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

  public pairingRequests: PairingRequest[] = [];
  public accessSessions: AccessSession[] = [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      deviceId: DEMO_DEVICE_OMEN_ID,
      ownerId: DEMO_USER_ID,
      sessionType: 'temporary_access',
      status: 'EXPIRED',
      durationMinutes: 30,
      createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
      authorizedAt: new Date(Date.now() - 90 * 60000).toISOString(),
      activatedAt: new Date(Date.now() - 89 * 60000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60000).toISOString(),
      revokedAt: null,
      revokedBy: null,
      createdBy: DEMO_USER_ID,
      failureReason: null,
      metadata: { requestedFor: "Friend visiting home" },
      updatedAt: new Date(Date.now() - 60 * 60000).toISOString(),
    },
  ];

  public pendingCommands: AuthorizationCommand[] = [];
  public auditLogs: AuditLog[] = [
    {
      id: 'd0000000-0000-0000-0000-000000000001',
      userId: DEMO_USER_ID,
      deviceId: DEMO_DEVICE_OMEN_ID,
      eventType: 'DEVICE_REGISTERED',
      timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
      ipHash: 'a8f3b92c10ef87a4',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
      success: true,
      reason: 'Paired via 8-char secure code',
      details: { hostname: 'OMEN-16-PRO' },
    },
    {
      id: 'd0000000-0000-0000-0000-000000000002',
      userId: DEMO_USER_ID,
      deviceId: DEMO_DEVICE_OMEN_ID,
      eventType: 'ACCESS_CREATED',
      timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
      ipHash: 'a8f3b92c10ef87a4',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
      success: true,
      reason: 'Temporary access granted for 30 minutes',
      details: { durationMinutes: 30 },
    },
    {
      id: 'd0000000-0000-0000-0000-000000000003',
      userId: DEMO_USER_ID,
      deviceId: DEMO_DEVICE_OMEN_ID,
      eventType: 'ACCESS_EXPIRED',
      timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
      ipHash: null,
      userAgent: 'iLock-Agent/1.2.0',
      success: true,
      reason: 'Access time window reached limit',
      details: { status: 'EXPIRED' },
    },
  ];

  public securityEvents: SecurityEvent[] = [];

  constructor() {
    // Periodically update session states and device online status
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.reconcile(), 10000);
    }
  }

  public reconcile() {
    const now = new Date();
    // 1. Reconcile sessions
    for (const session of this.accessSessions) {
      if (session.status === 'ACTIVE' || session.status === 'AUTHORIZED' || session.status === 'EXPIRING') {
        const nextState = evaluateSessionTimeState(session.status, new Date(session.expiresAt), now);
        if (nextState !== session.status) {
          session.status = nextState;
          session.updatedAt = now.toISOString();
          if (nextState === 'EXPIRED') {
            this.addAuditLog({
              userId: session.ownerId,
              deviceId: session.deviceId,
              eventType: 'ACCESS_EXPIRED',
              success: true,
              reason: 'Session reached time limit',
              details: { sessionId: session.id },
            });
          }
        }
      }
    }

    // 2. Reconcile device liveness
    const thresholdMs = 90 * 1000;
    for (const device of this.devices) {
      const lastSeenMs = new Date(device.lastSeen).getTime();
      if (now.getTime() - lastSeenMs > thresholdMs && device.status === 'online') {
        device.status = 'offline';
        device.updatedAt = now.toISOString();
      }
    }
  }

  public getDevices(ownerId = DEMO_USER_ID): Device[] {
    this.reconcile();
    return this.devices.filter((d) => d.ownerId === ownerId);
  }

  public getDeviceById(id: string): Device | undefined {
    this.reconcile();
    return this.devices.find((d) => d.id === id);
  }

  public getDeviceByUuid(uuid: string): Device | undefined {
    return this.devices.find((d) => d.deviceUuid === uuid);
  }

  public addDevice(device: Device) {
    this.devices.push(device);
  }

  public removeDevice(id: string, ownerId = DEMO_USER_ID): boolean {
    const idx = this.devices.findIndex((d) => d.id === id && d.ownerId === ownerId);
    if (idx === -1) return false;

    const [removed] = this.devices.splice(idx, 1);
    // Revoke any active sessions on this device
    for (const s of this.accessSessions) {
      if (s.deviceId === id && (s.status === 'ACTIVE' || s.status === 'AUTHORIZED' || s.status === 'EXPIRING')) {
        s.status = 'REVOKED';
        s.revokedAt = new Date().toISOString();
      }
    }

    this.addAuditLog({
      userId: ownerId,
      deviceId: id,
      eventType: 'DEVICE_REMOVED',
      success: true,
      reason: `Device '${removed?.deviceName}' removed by owner`,
      details: { deviceId: id },
    });
    return true;
  }

  public getSessions(ownerId = DEMO_USER_ID): AccessSession[] {
    this.reconcile();
    return this.accessSessions
      .filter((s) => s.ownerId === ownerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createSession(session: AccessSession): AccessSession {
    this.accessSessions.unshift(session);
    return session;
  }

  public revokeSession(sessionId: string, userId: string, reason = 'Owner manual revocation'): AccessSession | null {
    const session = this.accessSessions.find((s) => s.id === sessionId);
    if (!session) return null;

    if (!isValidSessionTransition(session.status, 'REVOKED')) {
      return session;
    }

    session.status = 'REVOKED';
    session.revokedAt = new Date().toISOString();
    session.revokedBy = userId;
    session.updatedAt = new Date().toISOString();

    // Lock device telemetry state immediately
    const tele = this.telemetry.get(session.deviceId);
    if (tele) {
      tele.workstationLocked = true;
      tele.updatedAt = new Date().toISOString();
    }

    this.addAuditLog({
      userId,
      deviceId: session.deviceId,
      eventType: 'ACCESS_REVOKED',
      success: true,
      reason,
      details: { sessionId: session.id },
    });

    return session;
  }

  public addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const entry: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.auditLogs.unshift(entry);
    return entry;
  }

  public addSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): SecurityEvent {
    const entry: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.securityEvents.unshift(entry);
    return entry;
  }

  public queueCommand(command: AuthorizationCommand) {
    this.pendingCommands.push(command);
  }

  public pullPendingCommands(deviceUuid: string): AuthorizationCommand[] {
    const device = this.getDeviceByUuid(deviceUuid);
    if (!device) return [];

    const now = Date.now();
    const commands = this.pendingCommands.filter(
      (c) => c.deviceId === device.id && !c.isAcknowledged && new Date(c.expiresAt).getTime() > now
    );

    for (const cmd of commands) {
      cmd.isDispatched = true;
      cmd.dispatchedAt = new Date().toISOString();
    }

    return commands;
  }
}

// Global demo store instance
const globalForDemo = global as unknown as { demoStore?: DemoStore };
export const demoStore = globalForDemo.demoStore || new DemoStore();
if (process.env.NODE_ENV !== 'production') {
  globalForDemo.demoStore = demoStore;
}
