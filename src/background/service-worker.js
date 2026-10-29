chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    'settings',
    'state',
    'candidates',
    'invitations',
    'automationDefaultsVersion',
  ]);
  const settings = {
    connectEnabled: false,
    withdrawEnabled: false,
    maxActionsPerRun: 20,
    paused: false,
    ...(stored.settings ?? {}),
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
      withdrawCount: 0,
    },
    candidates: stored.candidates ?? [],
    invitations: stored.invitations ?? [],
  });
});
chrome.runtime.onStartup.addListener(async () => {
  const { settings: current = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({
    settings: {
      connectEnabled: current.connectEnabled ?? false,
      withdrawEnabled: current.withdrawEnabled ?? false,
      maxActionsPerRun: Math.min(
        20,
        Math.max(1, Number(current.maxActionsPerRun) || 20),
      ),
      paused: current.paused ?? false,
    },
  });
});

let countUpdateQueue = Promise.resolve();

function incrementStateCount(field) {
  const update = countUpdateQueue.then(async () => {
    const { state = {} } = await chrome.storage.local.get('state');
    const nextState = {
      connectStatus: 'idle',
      withdrawStatus: 'idle',
      connectCount: 0,
      withdrawCount: 0,
      ...state,
      [field]: Number(state[field] ?? 0) + 1,
    };

    await chrome.storage.local.set({ state: nextState });
    return nextState;
  });

  countUpdateQueue = update.catch(() => {});
  return update;
}

function recordAction(message, field, sendResponse) {
  if (!message.payload?.id) {
    sendResponse({ success: false, error: 'Action id is required' });
    return;
  }

  incrementStateCount(field).then(
    (state) => sendResponse({ success: true, count: state[field] }),
    (error) =>
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] ?? null });
    });
    return true;
  }

  if (message.type === 'GET_PAGE_TYPE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? '';
      let pathname = '';
      try {
        pathname = new URL(url).pathname;
      } catch {
        sendResponse({ page: 'unknown' });
        return;
      }

      if (/^\/mynetwork\/invitation-manager\/sent\/?$/.test(pathname)) {
        sendResponse({ page: 'withdraw' });
        return;
      }

      if (
        /^\/mynetwork(?:\/.*)?$/.test(pathname) &&
        !pathname.startsWith('/mynetwork/invitation-manager')
      ) {
        sendResponse({ page: 'connect' });
        return;
      }

      sendResponse({ page: 'unknown' });
    });
    return true;
  }

  if (message.type === 'CONNECTION_DETECTED') {
    recordAction(message, 'connectCount', sendResponse);
    return true;
  }

  if (message.type === 'INVITATION_DETECTED') {
    recordAction(message, 'withdrawCount', sendResponse);
    return true;
  }

  return false;
});
