import type { TrackingClient, TrackingEventType } from './types';

export function trackEvent(
  client: TrackingClient,
  type: TrackingEventType,
  data: Record<string, string>
): void {
  client.track({ type, timestamp: new Date().toISOString(), data });
}
