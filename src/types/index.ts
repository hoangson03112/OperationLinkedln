export type AutomationStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error';

export interface ConnectionCandidate {
  id: string;
  name: string;
  profileUrl: string;
  detectedAt: number;
}

export interface Invitation {
  id: string;
  name: string;
  profileUrl: string;
  sentAt: number;
  status: 'sent' | 'withdrawn';
}

export interface AutomationSettings {
  connectEnabled: boolean;
  withdrawEnabled: boolean;
  maxActionsPerRun: number;
  paused?: boolean;
}

export interface AutomationState {
  connectStatus: AutomationStatus;
  withdrawStatus: AutomationStatus;
  connectCount: number;
  withdrawCount: number;
  connectStopReason?: 'weekly_invitation_limit';
  withdrawStopReason?: 'all_invitations_withdrawn';
}