/**
 * Keputusan akses perangkat untuk link e-book tanpa-login.
 *  - 'allow': perangkat sudah terikat → langsung layani.
 *  - 'claim': belum terikat tapi masih ada slot → ikat lalu layani.
 *  - 'deny' : slot penuh → tolak (pembeli minta admin reset).
 * Inilah jaminan anti-share untuk link akses.
 */
export type DeviceDecision = "allow" | "claim" | "deny";

export function decideDeviceAccess(devices: string[], deviceId: string, max = 2): DeviceDecision {
  if (devices.includes(deviceId)) return "allow";
  if (devices.length >= max) return "deny";
  return "claim";
}
