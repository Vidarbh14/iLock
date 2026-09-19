export interface ParsedTelemetry {
  user: string;
  wifiSsid: string;
  wifiSignal: number;
  localIp: string;
  cpuModel: string;
  cpuCores: number;
  cpuUsagePct: number;
  diskUsedGb: number;
  diskTotalGb: number;
  diskFreeGb: number;
  diskUsagePct: number;
  ramUsedGb: number;
  ramTotalGb: number;
  ramUsagePct: number;
  batteryPct: number;
  isCharging: boolean;
  uptime: string;
  os: string;
  isRich: boolean;
}

export function parseDeviceTelemetry(rawTelemetry: any, device?: any): ParsedTelemetry {
  let rich: any = {};
  let isRich = false;

  if (rawTelemetry?.active_user) {
    const trimmed = String(rawTelemetry.active_user).trim();
    if (trimmed.startsWith('{')) {
      try {
        rich = JSON.parse(trimmed);
        isRich = true;
      } catch {
        // Ignored non-json string
      }
    } else if (trimmed.startsWith('v1:')) {
      // Parse compact telemetry format: v1:user|wifiSsid|wifiSignal|localIp|cpuModel|disk|uptime
      isRich = true;
      const parts = trimmed.substring(3).split('|');
      if (parts[0]) rich.user = parts[0];
      if (parts[1]) rich.wifiSsid = parts[1];
      if (parts[2]) rich.wifiSignal = parseInt(parts[2], 10) || 90;
      if (parts[3]) rich.localIp = parts[3];
      if (parts[4]) rich.cpuModel = parts[4];
      if (parts[5]) {
        const diskParts = parts[5].split('/');
        if (diskParts.length === 2) {
          const free = parseFloat(diskParts[0].replace(/G/gi, ''));
          const total = parseFloat(diskParts[1].replace(/G/gi, ''));
          if (!isNaN(total) && !isNaN(free) && total > 0) {
            rich.diskTotalGb = total;
            rich.diskFreeGb = free;
            rich.diskUsedGb = Math.max(0, Math.round((total - free) * 10) / 10);
            rich.diskUsagePct = Math.round(((rich.diskUsedGb / total) * 100) * 10) / 10;
          }
        }
      }
      if (parts[6]) rich.uptime = parts[6];
    }
  }

  const rawUser = rich.user || (rawTelemetry?.active_user && !String(rawTelemetry.active_user).startsWith('{') && !String(rawTelemetry.active_user).startsWith('v1:')
    ? String(rawTelemetry.active_user)
    : 'vidar');

  const user = rich.user || rawUser;
  const wifiSsid = rich.wifiSsid || 'ARVH 5g';
  const wifiSignal = typeof rich.wifiSignal === 'number' ? rich.wifiSignal : 90;
  const localIp = rich.localIp || '192.168.29.218';
  const cpuModel = rich.cpuModel || 'AMD Ryzen 7 7840HS w/ Radeon 780M Graphics';
  const cpuCores = typeof rich.cpuCores === 'number' ? rich.cpuCores : 16;
  const cpuUsagePct = Math.round((rich.cpuUsagePct ?? rawTelemetry?.cpu_usage_pct ?? 12) * 10) / 10;
  
  const ramTotalGb = typeof rich.ramTotalGb === 'number' ? rich.ramTotalGb : 15.3;
  const rawRamPct = rich.ramUsagePct ?? rawTelemetry?.memory_usage_pct ?? 46;
  const ramUsagePct = Math.round(rawRamPct * 10) / 10;
  const ramUsedGb = typeof rich.ramUsedGb === 'number' 
    ? rich.ramUsedGb 
    : Math.round((ramTotalGb * (ramUsagePct / 100)) * 10) / 10;

  const diskTotalGb = typeof rich.diskTotalGb === 'number' ? rich.diskTotalGb : 476.0;
  const diskUsedGb = typeof rich.diskUsedGb === 'number' ? rich.diskUsedGb : 164.2;
  const diskFreeGb = typeof rich.diskFreeGb === 'number' 
    ? rich.diskFreeGb 
    : Math.round((diskTotalGb - diskUsedGb) * 10) / 10;
  const diskUsagePct = typeof rich.diskUsagePct === 'number'
    ? rich.diskUsagePct
    : Math.round(((diskUsedGb / diskTotalGb) * 100) * 10) / 10;

  const batteryPct = Math.round(rich.batteryPct ?? rawTelemetry?.battery_pct ?? 100);
  const isCharging = typeof rich.isCharging === 'boolean'
    ? rich.isCharging
    : (rawTelemetry?.is_charging ?? true);

  const uptime = rich.uptime || '14h 45m';
  const os = rich.os || device?.osVersion || 'Windows 11 Home (Build 26200)';

  return {
    user,
    wifiSsid,
    wifiSignal,
    localIp,
    cpuModel,
    cpuCores,
    cpuUsagePct,
    diskUsedGb,
    diskTotalGb,
    diskFreeGb,
    diskUsagePct,
    ramUsedGb,
    ramTotalGb,
    ramUsagePct,
    batteryPct,
    isCharging,
    uptime,
    os,
    isRich,
  };
}
