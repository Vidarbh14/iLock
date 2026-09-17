# iLock REST & Realtime API Specification

## Overview & Authentication

The iLock API enforces strict role separation between **Owner Clients** (browsers, iPhone PWA) and **Windows Agents** (background service on the PC).

### Authentication Methods
1. **User / Owner Requests**: Authenticated via Supabase Auth Bearer Session Tokens (or encrypted session cookies). Client-supplied user/owner IDs are never trusted and are always derived server-side.
2. **Windows Agent Requests**: Authenticated via asymmetric cryptographic signatures and device-specific authorization tokens (`X-Device-Token`).

### Standard Error Response Envelope
```json
{
  "error": {
    "code": "ACCESS_EXPIRED",
    "message": "This access session has expired.",
    "details": null
  }
}
```

---

## 1. Device Pairing & Enrollment

### `POST /api/devices/pair`
Initiates a single-use pairing session from the owner's dashboard.
- **Auth**: User Session
- **Rate Limit**: 5 requests / minute / user
- **Request**:
```json
{
  "deviceName": "Vidarbh's OMEN 16"
}
```
- **Response (200 OK)**:
```json
{
  "id": "7b8f9e12-3456-789a-bcde-f0123456789a",
  "deviceName": "Vidarbh's OMEN 16",
  "pairingCode": "ABCD-EFGH",
  "expiresAt": "2026-09-17T12:10:00.000Z",
  "expiresInSeconds": 600
}
```

### `POST /api/devices/register`
Called by the Windows Agent to complete asymmetric cryptographic enrollment.
- **Auth**: None (Validates single-use pairing code hash)
- **Rate Limit**: 10 requests / minute / IP
- **Request**:
```json
{
  "pairingCode": "ABCD-EFGH",
  "deviceUuid": "e2f4a1b0-9876-4abc-9def-0123456789ab",
  "hostname": "OMEN-16-PRO",
  "osVersion": "Windows 11 Pro 23H2",
  "agentVersion": "1.2.0",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8...\n-----END PUBLIC KEY-----",
  "publicKeyAlgorithm": "RSA-4096"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "deviceId": "b0000000-0000-0000-0000-000000000001",
  "deviceUuid": "e2f4a1b0-9876-4abc-9def-0123456789ab",
  "authToken": "d98f7e6a5b4c3d2e1f0a9b8c7d6e5f4a",
  "message": "Device successfully registered with iLock Cloud"
}
```

---

## 2. Device Management

### `GET /api/devices`
Lists all registered PCs belonging to the authenticated user.
- **Auth**: User Session
- **Response (200 OK)**:
```json
{
  "devices": [
    {
      "id": "b0000000-0000-0000-0000-000000000001",
      "deviceName": "Vidarbh's OMEN 16",
      "deviceUuid": "omen-16-win11-prod-001",
      "status": "online",
      "lastSeen": "2026-09-17T12:00:00.000Z",
      "device_status": [{
        "cpu_usage_pct": 14.2,
        "memory_usage_pct": 46.8,
        "battery_pct": 88.0,
        "workstation_locked": true
      }]
    }
  ]
}
```

### `POST /api/devices/:id/lock`
Dispatches an immediate workstation lock command to the PC.
- **Auth**: User Session
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Workstation lock command dispatched"
}
```

### `DELETE /api/devices/:id`
Disenrolls a PC, invalidates all credentials, terminates active sessions, and marks device untrusted.
- **Auth**: User Session
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Device removed and sessions invalidated"
}
```

---

## 3. Temporary Access Authorizations

### `POST /api/access/create`
Generates a short-lived authorization and dispatches the command to the Windows Agent.
- **Auth**: User Session
- **Rate Limit**: 15 requests / minute
- **Request**:
```json
{
  "deviceId": "b0000000-0000-0000-0000-000000000001",
  "durationMinutes": 30,
  "metadata": {
    "purpose": "Brother printing college syllabus"
  }
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "session": {
    "id": "c0000000-0000-0000-0000-000000000002",
    "deviceId": "b0000000-0000-0000-0000-000000000001",
    "status": "AUTHORIZED",
    "durationMinutes": 30,
    "expiresAt": "2026-09-17T12:30:00.000Z"
  }
}
```

### `POST /api/access/:id/revoke`
Immediately invalidates authorization and locks the computer without delay.
- **Auth**: User Session
- **Request**:
```json
{
  "reason": "Owner remote emergency kill switch"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "session": {
    "id": "c0000000-0000-0000-0000-000000000002",
    "status": "REVOKED",
    "revokedAt": "2026-09-17T12:15:22.000Z"
  }
}
```

---

## 4. Agent Telemetry & Inbound Commands

### `POST /api/agent/heartbeat`
Outbound periodic heartbeat sent every 30 seconds by the Windows Service.
- **Headers**: `X-Device-Token: <token>`
- **Request**:
```json
{
  "deviceUuid": "omen-16-win11-prod-001",
  "timestamp": 1726588800000,
  "nonce": "e3b0c44298fc1c149afbf4c8996fb924",
  "signature": "base64EncodedSignatureFromRsaKey",
  "workstationLocked": true,
  "cpuUsagePct": 12.5,
  "memoryUsagePct": 42.0,
  "batteryPct": 95.0,
  "isCharging": true,
  "activeUser": "vidarbh"
}
```
- **Response (200 OK)**:
```json
{
  "acknowledged": true,
  "serverTimeUtc": "2026-09-17T12:00:00.000Z",
  "pendingCommands": [
    {
      "id": "f0123456-789a-bcde-f012-3456789abcde",
      "commandType": "CREATE_ACCESS_SESSION",
      "sessionId": "c0000000-0000-0000-0000-000000000002",
      "nonce": "7a8b9c0d1e2f",
      "expiresAt": "2026-09-17T12:30:00.000Z",
      "payload": { "durationMinutes": 30 }
    }
  ]
}
```

### `POST /api/agent/command-result`
Acknowledges execution of a command with a signed receipt.
- **Headers**: `X-Device-Token: <token>`
- **Request**:
```json
{
  "commandId": "f0123456-789a-bcde-f012-3456789abcde",
  "sessionId": "c0000000-0000-0000-0000-000000000002",
  "status": "SUCCESS",
  "resultStatus": "AUTHORIZED_ACTIVE",
  "nonce": "3f2e1d0c",
  "timestamp": 1726588805000,
  "signature": "base64EncodedSignature"
}
```
