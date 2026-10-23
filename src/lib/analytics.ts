declare global {
  interface Window {
    gtag?: (
      command: 'event',
      eventName: string,
      params?: Record<string, string | number | boolean>,
    ) => void;
  }
}

export function trackEvent(
  name: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const payload: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      payload[key] = value;
    }
  }
  window.gtag('event', name, payload);
}

export function fileSizeMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}
