export type TrackingEventType = 'file_open' | 'file_save' | 'git_command' | 'tab_switch' | 'workspace_switch';

export interface TrackingEvent {
  type: TrackingEventType;
  timestamp: string;
  data: Record<string, string>;
}

export interface TrackingClient {
  track: (event: TrackingEvent) => void;
}
