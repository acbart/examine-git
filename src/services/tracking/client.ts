import type { TrackingClient } from './types';

export class NoopTrackingClient implements TrackingClient {
  track(): void {
    // noop - no tracking in stub
  }
}
