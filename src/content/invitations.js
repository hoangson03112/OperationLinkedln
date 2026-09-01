if (window.__linkedinConnectionManagerInvitationsInitialized) {
  throw new Error('Invitations content script already initialized');
}
window.__linkedinConnectionManagerInvitationsInitialized = true;

const withdrawState = {
  lock: false,
  processed: new Set(),
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

function safeReadSettings() {
  const storage = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;

  if (!storage) {
    return Promise.resolve({ settings: { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false } });
  }

  return new Promise((resolve) => {
    try {
      storage.get(['settings'], (result) => {
        if (chrome.runtime?.lastError) {
          resolve({ settings: { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false } });
          return;
        }

        resolve({ settings: result.settings ?? { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false } });
      });
    } catch (error) {
      resolve({ settings: { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false } });
    }
  });
}

function isInvitationPage() {
  return location.href.includes('/mynetwork/invitation-manager');
}

function isSentInvitationPage() {
  return /^\/mynetwork\/invitation-manager(?:\/.*)?$/.test(location.pathname) && !location.pathname.includes('/received') && !location.pathname.includes('/sent/received');
}

function matchesWithdrawSignal(value) {
  const text = normalizeText(value);
  return (
    text.includes('thu hoi') ||
    text.includes('withdraw') ||
    text.includes('cancel invitation') ||
    text.includes('huy') ||
    text.includes('remove invitation') ||
    text.includes('revoke') ||
    text.includes('cancel')
  );
}

function findWithdrawButtons() {
  const candidates = Array.from(document.querySelectorAll('button, a[role="button"], [data-control-name]'));

  return candidates
    .map((element) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const text = normalizeText(element.innerText || element.textContent || '');
      const label = normalizeText(element.getAttribute('aria-label') || '');
      const value = normalizeText(element.getAttribute('value') || '');
      const title = normalizeText(element.getAttribute('title') || '');
      const controlName = normalizeText(element.getAttribute('data-control-name') || '');
      const signal = [text, label, value, title, controlName].join(' ');
      const matches = matchesWithdrawSignal(signal);

      if (!matches || element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const visible = rect.width > 0 || rect.height > 0 || element.offsetParent !== null;
      if (!visible) {
        return null;
      }

      const row = element.closest('li') ?? element.closest('article') ?? element.closest('[data-view-name]') ?? element.closest('div');
      const profileLink = row?.querySelector('a[href*="/in/"]') ?? row?.querySelector('a[href*="/pub/"]') ?? row?.querySelector('a[href*="/company/"]');
      const profileUrl = profileLink?.href || '';
      const key = profileUrl || `${signal}-${Math.random().toString(16).slice(2)}`;

      return {
        element,
        key,
        profileUrl,
        name: profileLink?.innerText?.trim() || label || text || 'profile',
      };
    })
    .filter(Boolean)
    .filter((item) => !withdrawState.processed.has(item.key));
}

function findConfirmWithdrawButtons() {
  const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const text = normalizeText(element.innerText || element.textContent || '');
    const label = normalizeText(element.getAttribute('aria-label') || '');
    const title = normalizeText(element.getAttribute('title') || '');
    const controlName = normalizeText(element.getAttribute('data-control-name') || '');
    const visible = element.getBoundingClientRect().width > 0 || element.getBoundingClientRect().height > 0;

    const signal = [text, label, title, controlName].join(' ');
    return visible && matchesWithdrawSignal(signal);
  });

  if (!candidates.length) {
    return [];
  }

  return [...candidates].sort(() => Math.random() - 0.5);
}

async function processWithdrawQueue() {
  if (!isInvitationPage() || !isSentInvitationPage()) {
    return;
  }

  const result = await safeReadSettings();
  const settings = result.settings ?? { connectEnabled: true, withdrawEnabled: true, maxActionsPerRun: 6, paused: false };

  if (settings.paused || !settings.withdrawEnabled) {
    return;
  }

  if (withdrawState.lock) {
    return;
  }

  const baseLimit = Math.min(5, Math.max(1, Number(settings.maxActionsPerRun) || 3));
  const limit = Math.max(1, Math.min(baseLimit, 1 + Math.floor(Math.random() * baseLimit)));
  withdrawState.lock = true;

  try {
    const buttons = [...findWithdrawButtons()]
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    for (const item of buttons) {
      await humanDelay(2500, 7000);

      item.element.scrollIntoView({ block: 'center', inline: 'center' });
      window.scrollBy({ top: randomBetween(-100, 150), left: 0, behavior: 'auto' });
      triggerHumanClick(item.element);

      await humanDelay(1500, 3500);

      const confirmButton = findConfirmWithdrawButtons()[0];
      if (confirmButton) {
        confirmButton.scrollIntoView({ block: 'center', inline: 'center' });
        window.scrollBy({ top: randomBetween(-90, 140), left: 0, behavior: 'auto' });
        triggerHumanClick(confirmButton);
      }

      withdrawState.processed.add(item.key);

      chrome.runtime.sendMessage({
        type: 'INVITATION_DETECTED',
        payload: {
          id: item.key,
          name: item.name,
          profileUrl: item.profileUrl,
          sentAt: Date.now(),
          status: 'sent',
        },
      });

      await humanDelay(5000, 12000);
    }
  } finally {
    withdrawState.lock = false;
  }
}

const invitationObserver = new MutationObserver(() => {
  window.setTimeout(() => {
    void processWithdrawQueue();
  }, 400);
});

if (document.body) {
  invitationObserver.observe(document.body, { childList: true, subtree: true });
}

window.setInterval(() => {
  void processWithdrawQueue();
}, 4000);
