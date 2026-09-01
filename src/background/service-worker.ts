import {
  saveCandidate,
  saveInvitation
} from '../storage/storage';

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    settings: {
      connectEnabled: false,
      withdrawEnabled: false,
      maxActionsPerRun: 20
    },

    state: {
      connectStatus: 'idle',
      withdrawStatus: 'idle',
      connectCount: 0,
      withdrawCount: 0
    },

    candidates: [],

    invitations: []
  });
});

chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
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

          if (url.includes('/mynetwork')) {
            sendResponse({
              page: 'network'
            });

            return;
          }

          if (
            url.includes('/mynetwork/invitation-manager')
          ) {
            sendResponse({
              page: 'invitations'
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
      void saveCandidate(message.payload);

      sendResponse({
        success: true
      });

      return true;
    }

    if (message.type === 'INVITATION_DETECTED') {
      void saveInvitation(message.payload);

      sendResponse({
        success: true
      });

      return true;
    }
  }
);