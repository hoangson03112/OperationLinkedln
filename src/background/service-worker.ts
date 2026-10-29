import {
  getSettings,
  getState,
  saveCandidate,
  saveInvitation,
  updateSettings,
  updateState
} from '../storage/storage';

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    'settings',
    'state',
    'candidates',
    'invitations',
    'automationDefaultsVersion'
  ]);
  const settings = {
    ...(await getSettings()),
    ...(stored.settings ?? {})
  };

  if (stored.automationDefaultsVersion !== 1) {
    settings.connectEnabled = false;
    settings.withdrawEnabled = false;
  }

  await chrome.storage.local.set({
    settings,
    automationDefaultsVersion: 1,
    state: stored.state ?? {
      connectStatus: 'idle',
      withdrawStatus: 'idle',
      connectCount: 0,
      withdrawCount: 0
    },
    candidates: stored.candidates ?? [],
    invitations: stored.invitations ?? []
  });
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await updateSettings({
    connectEnabled: settings.connectEnabled ?? false,
    withdrawEnabled: settings.withdrawEnabled ?? false,
    maxActionsPerRun: Math.min(
      20,
      Math.max(1, Number(settings.maxActionsPerRun) || 20)
    ),
    paused: settings.paused ?? false
  });
});

let countUpdateQueue: Promise<unknown> = Promise.resolve();

function incrementCounter(
  counter: 'connectCount' | 'withdrawCount'
): Promise<number> {
  const update = countUpdateQueue.then(async () => {
    const state = await getState();
    const count = Number(state[counter] ?? 0) + 1;
    await updateState({ [counter]: count });
    return count;
  });

  countUpdateQueue = update.catch(() => undefined);
  return update;
}

function stopAutomation(
  automation: 'connect' | 'withdraw',
  reason: 'weekly_invitation_limit' | 'all_invitations_withdrawn'
): Promise<void> {
  const stopConfig = {
    connect: {
      enabledField: 'connectEnabled',
      statusField: 'connectStatus',
      reason: 'weekly_invitation_limit',
      status: 'error'
    },
    withdraw: {
      enabledField: 'withdrawEnabled',
      statusField: 'withdrawStatus',
      reason: 'all_invitations_withdrawn',
      status: 'completed'
    }
  }[automation];

  if (reason !== stopConfig.reason) {
    return Promise.reject(new Error('Invalid automation stop request'));
  }

  const update = countUpdateQueue.then(async () => {
    await updateSettings({ [stopConfig.enabledField]: false });
    const state = await getState();
    await updateState({
      ...state,
      [stopConfig.statusField]: stopConfig.status,
      [`${automation}StopReason`]: reason
    });
  });

  countUpdateQueue = update.catch(() => undefined);
  return update;
}

chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message.type === 'STOP_AUTOMATION') {
      const { automation, reason } = message.payload ?? {};
      if (
        (automation !== 'connect' && automation !== 'withdraw') ||
        (reason !== 'weekly_invitation_limit' &&
          reason !== 'all_invitations_withdrawn')
      ) {
        sendResponse({
          success: false,
          error: 'Invalid automation stop request'
        });
        return true;
      }

      void stopAutomation(automation, reason)
        .then(() => sendResponse({ success: true }))
        .catch(error =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        );
      return true;
    }

    if (message.type === 'GET_ACTIVE_TAB') {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true
        },
        tabs => {
          sendResponse({
            tab: tabs[0]
          });
        }
      );

      return true;
    }

    if (message.type === 'GET_PAGE_TYPE') {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true
        },
        tabs => {
          const url = tabs[0]?.url ?? '';
          let pathname = '';

          try {
            pathname = new URL(url).pathname;
          } catch {
            sendResponse({
              page: 'unknown'
            });
            return;
          }

          if (
            /^\/mynetwork\/invitation-manager\/sent\/?$/.test(pathname)
          ) {
            sendResponse({
              page: 'withdraw'
            });

            return;
          }

          if (
            /^\/mynetwork(?:\/.*)?$/.test(pathname) &&
            !pathname.startsWith('/mynetwork/invitation-manager')
          ) {
            sendResponse({
              page: 'connect'
            });

            return;
          }

          sendResponse({
            page: 'unknown'
          });
        }
      );

      return true;
    }
  }
);

chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message.type === 'CONNECTION_DETECTED') {
      if (!message.payload?.id) {
        sendResponse({
          success: false,
          error: 'Action id is required'
        });
        return true;
      }

      void saveCandidate(message.payload)
        .then(() => incrementCounter('connectCount'))
        .then(count => sendResponse({ success: true, count }))
        .catch(error =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        );
      return true;
    }

    if (message.type === 'INVITATION_DETECTED') {
      if (!message.payload?.id) {
        sendResponse({
          success: false,
          error: 'Action id is required'
        });
        return true;
      }

      void saveInvitation(message.payload)
        .then(() => incrementCounter('withdrawCount'))
        .then(count => sendResponse({ success: true, count }))
        .catch(error =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        );
      return true;
    }
  }
);