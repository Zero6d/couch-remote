import os from 'node:os';

/** First non-internal IPv4 address, preferring real adapters over virtual ones (Hyper-V, WSL, VPN). */
export function lanAddress(): string | undefined {
  const candidates: { name: string; address: string }[] = [];
  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) candidates.push({ name, address: info.address });
    }
  }
  const virtual = /vethernet|wsl|virtual|vmware|tailscale|docker|hyper-v|loopback/i;
  const physical = candidates.find((c) => !virtual.test(c.name));
  return (physical ?? candidates[0])?.address;
}

export function pairUrl(port: number, token: string): string {
  const host = lanAddress() ?? 'localhost';
  return `http://${host}:${port}/?pair=${token}`;
}
