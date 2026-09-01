import type {
  AutomationSettings,
  AutomationState,
  ConnectionCandidate,
  Invitation,
} from "../types";

const DEFAULT_SETTINGS: AutomationSettings = {
  connectEnabled: false,
  withdrawEnabled: false,
  maxActionsPerRun: 20,
};

const DEFAULT_STATE: AutomationState = {
  connectStatus: "idle",
  withdrawStatus: "idle",
  connectCount: 0,
  withdrawCount: 0,
};

export async function getSettings(): Promise<AutomationSettings> {
  const result = await chrome.storage.local.get("settings");

  return {
    ...DEFAULT_SETTINGS,
    ...(result.settings ?? {}),
  };
}

export async function updateSettings(
  settings: Partial<AutomationSettings>,
): Promise<void> {
  const current = await getSettings();

  await chrome.storage.local.set({
    settings: {
      ...current,
      ...settings,
    },
  });
}

export async function getState(): Promise<AutomationState> {
  const result = await chrome.storage.local.get("state");

  return {
    ...DEFAULT_STATE,
    ...(result.state ?? {}),
  };
}

export async function updateState(
  state: Partial<AutomationState>,
): Promise<void> {
  const current = await getState();

  await chrome.storage.local.set({
    state: {
      ...current,
      ...state,
    },
  });
}

export async function getCandidates(): Promise<ConnectionCandidate[]> {
  const result = await chrome.storage.local.get("candidates");

  return result.candidates ?? [];
}

export async function saveCandidate(
  candidate: ConnectionCandidate,
): Promise<void> {
  const candidates = await getCandidates();

  const exists = candidates.some(
    (item) => item.profileUrl === candidate.profileUrl,
  );

  if (exists) {
    return;
  }

  await chrome.storage.local.set({
    candidates: [...candidates, candidate],
  });
}

export async function getInvitations(): Promise<Invitation[]> {
  const result = await chrome.storage.local.get("invitations");

  return result.invitations ?? [];
}

export async function saveInvitation(invitation: Invitation): Promise<void> {
  const invitations = await getInvitations();

  const exists = invitations.some((item) => item.id === invitation.id);

  if (exists) {
    return;
  }

  await chrome.storage.local.set({
    invitations: [...invitations, invitation],
  });
}
