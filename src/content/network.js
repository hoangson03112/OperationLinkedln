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

function triggerHumanClick(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.focus?.();
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width * randomBetween(0.2, 0.8);
  const y = rect.top + rect.height * randomBetween(0.2, 0.8);

  element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
  element.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
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

function safeReadSettings() {
  const storage = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;
  if (!storage) {
    return Promise.resolve({ settings: { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false } });
  }

  return new Promise((resolve) => {
    try {
      storage.get(['settings'], (result) => {
        resolve({ settings: result.settings ?? { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false } });
      });
    } catch (error) {
      resolve({ settings: { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false } });
    }
  });
}

function matchesConnectSignal(value) {
  const normal = normalizeText(value);
  return (
    normal.includes('connect') ||
    normal.includes('ket noi') ||
    normal.includes('invite') ||
    normal.includes('gui loi moi') ||
    normal.includes('send invitation') ||
    normal.includes('gui ngay') ||
    normal.includes('request connection')
  );
}

function findConnectButtons() {
  const nodes = Array.from(document.querySelectorAll('button, a[role="button"], [data-control-name]'));
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
    if (!isConnectLike || node.disabled || node.getAttribute('aria-disabled') === 'true') {
      continue;
    }

    if (!isVisible(node)) {
      continue;
    }

    const ignored = /message|follow|view profile|open to work|edit|save|more|reply|accept|ignore|hiring|jobs|chat/i.test(signal);
    if (ignored && !/connect|ket noi|invite|send invitation|request connection/.test(signal)) {
      continue;
    }

    const row = node.closest('li') ?? node.closest('article') ?? node.closest('[data-view-name]') ?? node.closest('div');
    const profileLink = row?.querySelector('a[href*="/in/"]') ?? row?.querySelector('a[href*="/pub/"]') ?? row?.querySelector('a[href*="/company/"]');
    const href = profileLink?.href || '';
    const profileUrl = href ? new URL(href, window.location.origin).href : '';

    if (!profileUrl && !/connect|ket noi|invite|request connection/.test(signal)) {
      continue;
    }

    const dedupeKey = profileUrl || `${signal}-${Math.random().toString(16).slice(2)}`;
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

function findConfirmConnectButton() {
  const candidates = Array.from(document.querySelectorAll('button, a[role="button"], [data-control-name]'))
    .filter((element) => element instanceof HTMLElement && isVisible(element));

  const filtered = candidates.filter((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const text = normalizeText(element.innerText || element.textContent || '');
    const label = normalizeText(element.getAttribute('aria-label') || '');
    const title = normalizeText(element.getAttribute('title') || '');
    const controlName = normalizeText(element.getAttribute('data-control-name') || '');
    const signal = [text, label, title, controlName].join(' ');

    return (
      signal.includes('send now') ||
      signal.includes('gui ngay') ||
      signal.includes('send invitation') ||
      signal.includes('connect') ||
      signal.includes('ket noi')
    );
  });

  if (!filtered.length) {
    return null;
  }

  return filtered[Math.floor(Math.random() * filtered.length)];
}

async function processConnectQueue() {
  if (!isNetworkLikePage()) {
    return;
  }

  const result = await safeReadSettings();
  const settings = result.settings ?? { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false };

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

  const baseLimit = Math.min(5, Math.max(1, Number(settings.maxActionsPerRun) || 3));
  const limit = Math.max(1, Math.min(baseLimit, 1 + Math.floor(Math.random() * baseLimit)));
  connectState.lock = true;

  try {
    const buttons = [...findConnectButtons()]
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    for (const item of buttons) {
      await humanDelay(2500, 7000);

      item.element.scrollIntoView({ block: 'center', inline: 'center' });
      window.scrollBy({ top: randomBetween(-80, 120), left: 0, behavior: 'auto' });
      triggerHumanClick(item.element);

      await humanDelay(1800, 4200);

      const confirmButton = findConfirmConnectButton();
      if (confirmButton && !confirmButton.hasAttribute('disabled')) {
        confirmButton.scrollIntoView({ block: 'center', inline: 'center' });
        window.scrollBy({ top: randomBetween(-40, 90), left: 0, behavior: 'auto' });
        triggerHumanClick(confirmButton);
      }

      connectState.processed.add(item.key);
      connectState.lastActionAt = Date.now();

      chrome.runtime.sendMessage({
        type: 'CONNECTION_DETECTED',
        payload: {
          id: item.key,
          name: item.name,
          profileUrl: item.profileUrl,
          detectedAt: Date.now(),
        },
      });

      await humanDelay(5000, 12000);
    }
  } finally {
    connectState.lock = false;
  }
}

const networkObserver = new MutationObserver(() => {
  window.setTimeout(() => {
    void processConnectQueue();
  }, 500);
});

if (document.body) {
  networkObserver.observe(document.body, { childList: true, subtree: true });
}

window.setInterval(() => {
  void processConnectQueue();
}, 7000);

console.log('[ConnectionManager:connect] active on', location.pathname);
