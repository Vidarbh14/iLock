// ==============================================================================
// iLock TypeScript / Node Cross-Platform Agent Simulator
// Full cryptographic parity with the C# .NET Windows Agent
// ==============================================================================

import crypto from 'node:crypto';
import {
  generateDeviceKeyPair,
  signPayload,
  verifyDeviceSignature,
} from '../../packages/security/src/crypto.js';
import type {
  AgentHeartbeatInput,
  CommandResultInput,
  RegisterDeviceInput,
} from '../../packages/shared/src/schemas.js';

export interface SimulatorOptions {
  backendUrl: string;
  deviceUuid?: string;
  deviceName?: string;
  hostname?: string;
  heartbeatIntervalSeconds?: number;
}

export class AgentSimulator {
  private backendUrl: string;
  public deviceUuid: string;
  public deviceName: string;
  public hostname: string;
  public keyPair: { publicKey: string; privateKey: string };
  private authToken: string | null = null;
  private isRunning = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private activeSessionId: string | null = null;
  private isLocked = true;

  constructor(options: SimulatorOptions) {
    this.backendUrl = options.backendUrl.replace(/\/$/, '');
    this.deviceUuid = options.deviceUuid || crypto.randomUUID();
    this.deviceName = options.deviceName || `Simulated-PC-${this.deviceUuid.slice(0, 6)}`;
    this.hostname = options.hostname || `SIM-PC-${this.deviceUuid.slice(0, 4).toUpperCase()}`;
    this.keyPair = generateDeviceKeyPair(2048);
  }

  /**
   * Registers this device with the cloud backend using an active pairing code.
   */
  public async pair(pairingCode: string): Promise<{ success: boolean; message?: string }> {
    const payload: RegisterDeviceInput = {
      pairingCode: pairingCode.trim().toUpperCase(),
      deviceUuid: this.deviceUuid,
      hostname: this.hostname,
      osVersion: 'Windows 11 Pro 23H2 (Agent Simulator)',
      agentVersion: '1.0.0-sim',
      publicKey: this.keyPair.publicKey,
      publicKeyAlgorithm: 'RSA-4096',
    };

    try {
      const res = await fetch(`${this.backendUrl}/api/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.error?.message || data.message || 'Pairing failed' };
      }

      this.authToken = data.authToken;
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Starts sending background heartbeats and processing commands.
   */
  public start(intervalSeconds = 5): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.heartbeatTimer = setInterval(() => this.cycleHeartbeat(), intervalSeconds * 1000);
    this.cycleHeartbeat();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public async cycleHeartbeat(): Promise<void> {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const payloadToSign = `${this.deviceUuid}:${timestamp}:${nonce}:${this.isLocked}`;
    const signature = signPayload(this.keyPair.privateKey, payloadToSign);

    const heartbeat: AgentHeartbeatInput = {
      deviceUuid: this.deviceUuid,
      timestamp,
      nonce,
      signature,
      cpuUsagePct: 12.5,
      memoryUsagePct: 42.0,
      batteryPct: 95.0,
      isCharging: true,
      activeUser: 'simulated_user',
      workstationLocked: this.isLocked,
    };

    try {
      const res = await fetch(`${this.backendUrl}/api/agent/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken ? { 'X-Device-Token': this.authToken } : {}),
        },
        body: JSON.stringify(heartbeat),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.pendingCommands && Array.isArray(data.pendingCommands)) {
        for (const cmd of data.pendingCommands) {
          await this.executeCommand(cmd);
        }
      }
    } catch (err) {
      // Network transient
    }
  }

  private async executeCommand(cmd: any): Promise<void> {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    let status: 'SUCCESS' | 'FAILED' | 'REJECTED' = 'SUCCESS';
    let resultStatus = 'OK';
    let error: string | null = null;

    if (cmd.commandType === 'CREATE_ACCESS_SESSION') {
      this.activeSessionId = cmd.sessionId;
      this.isLocked = false;
      resultStatus = 'AUTHORIZED_ACTIVE';
    } else if (cmd.commandType === 'REVOKE_ACCESS_SESSION') {
      this.activeSessionId = null;
      this.isLocked = true;
      resultStatus = 'REVOKED';
    } else if (cmd.commandType === 'LOCK_REQUEST') {
      this.isLocked = true;
      resultStatus = 'LOCKED';
    } else if (cmd.commandType === 'DEVICE_PING') {
      resultStatus = 'PONG';
    } else {
      status = 'REJECTED';
      error = `Unknown command ${cmd.commandType}`;
    }

    const dataToSign = `${cmd.id}:${status}:${timestamp}:${nonce}`;
    const signature = signPayload(this.keyPair.privateKey, dataToSign);

    const resultPayload: CommandResultInput = {
      commandId: cmd.id,
      sessionId: cmd.sessionId ?? null,
      status,
      resultStatus,
      error,
      nonce,
      timestamp,
      signature,
    };

    await fetch(`${this.backendUrl}/api/agent/command-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { 'X-Device-Token': this.authToken } : {}),
      },
      body: JSON.stringify(resultPayload),
    });
  }

  public getStatus() {
    return {
      deviceUuid: this.deviceUuid,
      isLocked: this.isLocked,
      activeSessionId: this.activeSessionId,
      hasAuthToken: !!this.authToken,
    };
  }
}
