chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    settings: {
      connectEnabled: true,
      withdrawEnabled: true,
      maxActionsPerRun: 6,
      paused: false,
    },
    state: {
      connectStatus: 'idle',
      withdrawStatus: 'idle',
      connectCount: 0,
      withdrawCount: 0,
    },
    candidates: [],
    invitations: [],
  });
});
chrome.runtime.onStartup.addListener(async () => {
  await chrome.storage.local.get(['settings'], async (result) => {
    const current = result.settings ?? {};
    await chrome.storage.local.set({
      settings: {
        connectEnabled: current.connectEnabled ?? true,
        withdrawEnabled: current.withdrawEnabled ?? true,
        maxActionsPerRun: current.maxActionsPerRun ?? 6,
        paused: current.paused ?? false,
      },
    });
  });
});
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

      if (url.includes('/mynetwork')) {
        sendResponse({ page: 'network' });
        return;
      }

      if (url.includes('/mynetwork/invitation-manager')) {
        sendResponse({ page: 'invitations' });
        return;
      }

      sendResponse({ page: 'unknown' });
    });
    return true;
  }

  if (message.type === 'CONNECTION_DETECTED') {
    chrome.storage.local.get(['state'], async (result) => {
      const state = result.state ?? {
        connectStatus: 'idle',
        withdrawStatus: 'idle',
        connectCount: 0,
        withdrawCount: 0,
      };

      await chrome.storage.local.set({
        state: {
          ...state,
          connectCount: Number(state.connectCount ?? 0) + 1,
        },
      });
    });

    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'INVITATION_DETECTED') {
    chrome.storage.local.get(['state'], async (result) => {
      const state = result.state ?? {
        connectStatus: 'idle',
        withdrawStatus: 'idle',
        connectCount: 0,
        withdrawCount: 0,
      };

      await chrome.storage.local.set({
        state: {
          ...state,
          withdrawCount: Number(state.withdrawCount ?? 0) + 1,
        },
      });
    });

    sendResponse({ success: true });
    return true;
  }

  return false;
});
