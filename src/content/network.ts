export {};

interface ConnectionButton {
  element: HTMLElement;
  profileUrl: string;
  name: string;
}

function getProfileUrl(element: HTMLElement): string {
  const container =
    element.closest('li') ??
    element.closest('[data-view-name]') ??
    element.parentElement;

  const link = container?.querySelector(
    'a[href*="/in/"]'
  ) as HTMLAnchorElement | null;

  return link?.href ?? '';
}

function getName(element: HTMLElement): string {
  const container =
    element.closest('li') ??
    element.closest('[data-view-name]') ??
    element.parentElement;

  const nameElement =
    container?.querySelector(
      'a[href*="/in/"]'
    ) as HTMLElement | null;

  return nameElement?.innerText.trim() ?? '';
}

function findConnectButtons(): ConnectionButton[] {
  const elements = Array.from(
    document.querySelectorAll('button')
  ) as HTMLButtonElement[];

  return elements
    .filter(button => {
      const text = button.innerText
        .trim()
        .toLowerCase();

      return text === 'connect';
    })
    .map(element => ({
      element,
      profileUrl: getProfileUrl(element),
      name: getName(element)
    }))
    .filter(item => Boolean(item.profileUrl));
}

async function scanConnections(): Promise<void> {
  const buttons = findConnectButtons();

  for (const item of buttons) {
    await chrome.runtime.sendMessage({
      type: 'CONNECTION_DETECTED',
      payload: {
        id: item.profileUrl,
        name: item.name,
        profileUrl: item.profileUrl,
        detectedAt: Date.now()
      }
    });
  }
}

const observer = new MutationObserver(() => {
  void scanConnections();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

void scanConnections();