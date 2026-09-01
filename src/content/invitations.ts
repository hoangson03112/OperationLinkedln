export {};

interface PendingInvitation {
  element: HTMLElement;
  name: string;
  profileUrl: string;
}

function findWithdrawButtons(): PendingInvitation[] {
  const selectors = [
    'a[aria-label*="Thu hồi"]',
    'a[aria-label*="Thu hoi"]',
    'a[aria-label*="withdraw"]',
    'a[aria-label*="cancel"]',
    'a[aria-label*="huy"]',
    'button[aria-label*="Thu hồi"]',
    'button[aria-label*="Thu hoi"]',
    'button[aria-label*="withdraw"]',
    'button[aria-label*="cancel"]',
    'button[aria-label*="huy"]'
  ];

  const matches = new Map<Element, Element>();

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      matches.set(element, element);
    });
  });

  document.querySelectorAll('a, button').forEach(element => {
    const htmlElement = element as HTMLElement;
    const text = (htmlElement.innerText || htmlElement.textContent || '').trim().toLowerCase();
    const label = (htmlElement.getAttribute('aria-label') || '').trim().toLowerCase();

    if (text.includes('thu hoi') || text.includes('withdraw') || label.includes('thu hoi') || label.includes('withdraw')) {
      matches.set(element, element);
    }
  });

  return Array.from(matches.keys())
    .map(element => {
      const container = element.closest('li') ?? element.closest('article') ?? element.closest('[data-view-name]') ?? element.parentElement ?? element.closest('div');
      const link = element.closest('a') ?? container?.querySelector('a[href*="/in/"]') ?? container?.querySelector('a[href*="/pub/"]');

      return {
        element: element as HTMLElement,
        name: link?.innerText.trim() ?? element.getAttribute('aria-label')?.replace(/^Thu hồi lời mời (đã gửi đến|duoc gui den)/i, '').trim() ?? '',
        profileUrl: (element as HTMLAnchorElement).href || link?.href || location.href
      };
    })
    .filter(item => Boolean(item.profileUrl) && !item.element.hasAttribute('disabled'));
}

async function scanInvitations(): Promise<void> {
  const invitations = findWithdrawButtons();

  for (const invitation of invitations) {
    await chrome.runtime.sendMessage({
      type: 'INVITATION_DETECTED',
      payload: {
        id: invitation.profileUrl,
        name: invitation.name,
        profileUrl: invitation.profileUrl,
        sentAt: Date.now(),
        status: 'sent'
      }
    });
  }
}

const observer = new MutationObserver(() => {
  void scanInvitations();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

void scanInvitations();