if (window.__linkedinConnectionManagerNetworkInitialized) {
  throw new Error('Network content script already initialized');
}
window.__linkedinConnectionManagerNetworkInitialized = true;

const connectState = {
  lock: false,
  processed: new Set(),
  lastActionAt: 0,
};

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function humanDelay(minMs, maxMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, randomBetween(minMs, maxMs));
  });
}

function clickElement(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.click();
}

function normalizeText(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 || element.offsetParent !== null || !!element.getClientRects?.length;
}

function isNetworkLikePage() {
  return /^\/mynetwork(?:\/.*)?$/.test(location.pathname) && !location.pathname.startsWith('/mynetwork/invitation-manager');
}

function isExtensionValid() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

function safeSendMessage(message) {
  if (!isExtensionValid()) {
    return Promise.reject(new Error('Extension context is unavailable'));
  }
  return chrome.runtime.sendMessage(message);
}

function safeReadSettings() {
  const disabledSettings = {
    connectEnabled: false,
    withdrawEnabled: false,
    maxActionsPerRun: 20,
    paused: false,
  };

  if (!isExtensionValid() || !chrome.storage?.local) {
    return Promise.reject(new Error('Extension storage is unavailable'));
  }

  const storage = chrome.storage.local;
  return new Promise((resolve, reject) => {
    try {
      storage.get(['settings'], (result) => {
        if (!isExtensionValid() || chrome.runtime?.lastError) {
          reject(
            new Error(
              chrome.runtime?.lastError?.message ??
                'Could not read extension settings',
            ),
          );
          return;
        }

        resolve({ settings: result.settings ?? disabledSettings });
      });
    } catch (error) {
      reject(error);
    }
  });
}

function matchesConnectSignal(value) {
  const normal = normalizeText(value);
  return (
    /\bconnect\b/.test(normal) ||
    /\binvite\b/.test(normal) ||
    /\bsend invitation\b/.test(normal) ||
    /\brequest connection\b/.test(normal) ||
    /\bket noi\b/.test(normal) ||
    /\b(gui loi moi|moi ket noi)\b/.test(normal)
  );
}

function getConnectionContext(element) {
  let current = element.parentElement;

  for (let depth = 0; current && depth < 10; depth += 1) {
    const profileLink = current.querySelector(
      'a[href*="/in/"], a[href*="/pub/"], a[href*="/company/"]',
    );
    if (profileLink) {
      return { row: current, profileLink };
    }

    if (current.matches('li, article, [data-view-name], [data-urn]')) {
      return { row: current, profileLink: null };
    }

    current = current.parentElement;
  }

  return { row: element.parentElement, profileLink: null };
}

function findConnectButtons() {
  const nodes = Array.from(
    document.querySelectorAll('button, a[role="button"], [role="button"]'),
  );
  const matches = [];

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const text = normalizeText(node.innerText || node.textContent || '');
    const label = normalizeText(node.getAttribute('aria-label') || '');
    const title = normalizeText(node.getAttribute('title') || '');
    const controlName = normalizeText(node.getAttribute('data-control-name') || '');
    const signal = [text, label, title, controlName].join(' ');

    const isConnectLike = matchesConnectSignal(signal);
    if (
      !isConnectLike ||
      node.hasAttribute('disabled') ||
      node.getAttribute('aria-disabled') === 'true' ||
      node.closest('[role="dialog"], [aria-modal="true"]')
    ) {
      continue;
    }

    if (!isVisible(node)) {
      continue;
    }

    const ignored = /message|follow|view profile|open to work|edit|save|more|reply|accept|ignore|hiring|jobs|chat/i.test(signal);
    if (ignored && !/connect|ket noi|invite|send invitation|request connection/.test(signal)) {
      continue;
    }

    const { row, profileLink } = getConnectionContext(node);
    const href = profileLink?.href || '';
    const profileUrl = href ? new URL(href, window.location.origin).href : '';

    if (!profileUrl && !/connect|ket noi|invite|request connection/.test(signal)) {
      continue;
    }

    if (!profileUrl) {
      continue;
    }

    const dedupeKey = new URL(profileUrl).pathname.replace(/\/+$/, '');
    if (connectState.processed.has(dedupeKey)) {
      continue;
    }

    matches.push({
      element: node,
      profileUrl: profileUrl || dedupeKey,
      key: dedupeKey,
      name: profileLink?.innerText?.trim() || node.innerText?.trim() || label || 'profile',
    });
  }

  return matches;
}

function findConnectDialog() {
  return Array.from(
    document.querySelectorAll('[role="dialog"], [aria-modal="true"]'),
  ).find(isVisible);
}

function findConfirmConnectButton() {
  const dialog = findConnectDialog();
  if (!dialog) {
    return null;
  }

  return Array.from(dialog.querySelectorAll('button, [role="button"]')).find(
    (element) => {
      if (
        !(element instanceof HTMLElement) ||
        !isVisible(element) ||
        element.hasAttribute('disabled') ||
        element.getAttribute('aria-disabled') === 'true'
      ) {
        return false;
      }

      const signal = [
        element.innerText || element.textContent || '',
        element.getAttribute('aria-label') || '',
        element.getAttribute('title') || '',
      ]
        .map(normalizeText)
        .join(' ');

      return /\b(send|send now|send invitation|gui ngay|gui loi moi)\b/.test(signal);
    },
  );
}

function waitFor(check, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const poll = () => {
      const value = check();
      if (value || Date.now() - startedAt >= timeoutMs) {
        resolve(value || null);
        return;
      }
      window.setTimeout(poll, 100);
    };
    poll();
  });
}

let networkInterval = null;

function stopConnectScript() {
  networkObserver.disconnect();
  if (networkInterval) {
    clearInterval(networkInterval);
    networkInterval = null;
  }
}

async function processConnectQueue() {
  if (!isExtensionValid()) {
    stopConnectScript();
    return;
  }

  if (!isNetworkLikePage()) {
    return;
  }

  const result = await safeReadSettings();
  const settings = result.settings;

  if (settings.paused || !settings.connectEnabled) {
    return;
  }

  if (connectState.lock) {
    return;
  }

  const now = Date.now();
  if (connectState.lastActionAt && now - connectState.lastActionAt < 18000) {
    return;
  }

  const baseLimit = Math.min(20, Math.max(1, Number(settings.maxActionsPerRun) || 1));
  const limit = baseLimit;
  connectState.lock = true;

  try {
    const buttons = [...findConnectButtons()]
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    for (const item of buttons) {
      if (!isExtensionValid()) {
        stopConnectScript();
        return;
      }

      if (
        !item.element.isConnected ||
        item.element.hasAttribute('disabled') ||
        item.element.getAttribute('aria-disabled') === 'true'
      ) {
        continue;
      }

      if (findConnectDialog()) {
        console.warn('A dialog is already open; skipping connection request', item.key);
        continue;
      }

      await humanDelay(800, 1600);

      item.element.scrollIntoView({ block: 'center', inline: 'center' });
      clickElement(item.element);

      const dialogOpened = await waitFor(() => findConnectDialog(), 1200);
      const confirmButton = dialogOpened
        ? await waitFor(() => findConfirmConnectButton(), 2000)
        : false;
      if (dialogOpened && !confirmButton) {
        console.warn(
          'Connection confirmation button was not found',
          item.key,
        );
        continue;
      }
      if (confirmButton) {
        clickElement(confirmButton);
      }

      const completed = await waitFor(
        () =>
          !item.element.isConnected ||
          /pending|requested|sent|withdraw|message/.test(
            normalizeText(
              [
                item.element.innerText,
                item.element.getAttribute('aria-label'),
                item.element.getAttribute('title'),
              ].join(' '),
            ),
          ),
        8000,
      );
      if (!completed) {
        console.warn('Connection request was not confirmed in the list', item.key);
        continue;
      }

      const response = await safeSendMessage({
        type: 'CONNECTION_DETECTED',
        payload: {
          id: item.key,
          name: item.name,
          profileUrl: item.profileUrl,
          detectedAt: Date.now(),
        },
      });
      if (!response?.success) {
        throw new Error(response?.error ?? 'Could not update the connection counter');
      }

      connectState.processed.add(item.key);
      connectState.lastActionAt = Date.now();
      await humanDelay(1500, 3000);
    }
  } finally {
    connectState.lock = false;
  }
}

const networkObserver = new MutationObserver(() => {
  if (!isExtensionValid()) {
    stopConnectScript();
    return;
  }
  window.setTimeout(() => {
    void processConnectQueue().catch((error) => {
      console.error('Could not process connection requests', error);
    });
  }, 500);
});

if (document.body) {
  networkObserver.observe(document.body, { childList: true, subtree: true });
}

networkInterval = window.setInterval(() => {
  void processConnectQueue().catch((error) => {
    console.error('Could not process connection requests', error);
  });
}, 7000);

console.log('[ConnectionManager:connect] active on', location.pathname);
