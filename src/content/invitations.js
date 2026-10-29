if (window.__linkedinConnectionManagerInvitationsInitialized) {
  throw new Error("Invitations content script already initialized");
}
window.__linkedinConnectionManagerInvitationsInitialized = true;

const withdrawState = {
  lock: false,
  processed: new Set(),
  retryAfter: new Map(),
  lastNoButtonsLogAt: 0,
};

function normalizeText(value) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isExtensionValid() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}

function safeSendMessage(message) {
  if (!isExtensionValid()) {
    return Promise.reject(new Error("Extension context is unavailable"));
  }
  return chrome.runtime.sendMessage(message);
}

function safeReadSettings() {
  if (!isExtensionValid() || !chrome.storage?.local) {
    return Promise.reject(new Error("Extension storage is unavailable"));
  }

  const storage = chrome.storage.local;
  return new Promise((resolve, reject) => {
    try {
      storage.get(["settings"], (result) => {
        if (!isExtensionValid() || chrome.runtime?.lastError) {
          reject(
            new Error(
              chrome.runtime?.lastError?.message ??
                "Could not read extension settings",
            ),
          );
          return;
        }

        resolve({
          settings: result.settings ?? {
            connectEnabled: false,
            withdrawEnabled: false,
            maxActionsPerRun: 20,
            paused: true,
          },
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

function isInvitationPage() {
  return location.href.includes("/mynetwork/invitation-manager");
}

function isSentInvitationPage() {
  return /^\/mynetwork\/invitation-manager\/sent\/?$/.test(location.pathname);
}

function isWithdrawLabel(value) {
  const text = normalizeText(value);
  return (
    /\bwithdraw\b/.test(text) ||
    /\bcancel\s+(?:the\s+)?invitation\b/.test(text) ||
    /\bremove\s+(?:the\s+)?invitation\b/.test(text) ||
    /\bthu hoi(?: loi moi)?\b/.test(text) ||
    /\bhuy loi moi\b/.test(text)
  );
}

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getButtonLabels(element) {
  return [
    element.innerText || element.textContent || "",
    element.getAttribute("aria-label") || "",
    element.getAttribute("title") || "",
    element.getAttribute("data-control-name") || "",
  ];
}

function isEnabled(element) {
  return (
    !element.hasAttribute("disabled") &&
    element.getAttribute("aria-disabled") !== "true"
  );
}

function getInvitationContext(element) {
  let current = element.parentElement;

  for (let depth = 0; current && depth < 10; depth += 1) {
    const profileLink = current.querySelector(
      'a[href*="/in/"], a[href*="/pub/"], a[href*="/company/"]',
    );
    if (profileLink) {
      return { row: current, profileLink };
    }

    if (current.matches("li, article, [data-view-name], [data-urn]")) {
      return { row: current, profileLink: null };
    }

    current = current.parentElement;
  }

  return { row: element.parentElement, profileLink: null };
}

function findWithdrawButtons() {
  const candidates = Array.from(
    document.querySelectorAll(
      'button, a, [role="button"], [data-control-name][tabindex]',
    ),
  );

  return candidates
    .map((element, index) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const isButton =
        element.tagName === "BUTTON" ||
        element.getAttribute("role") === "button";
      const isLink =
        element instanceof HTMLAnchorElement && element.hasAttribute("href");
      const isFocusableControl =
        element.hasAttribute("data-control-name") && element.tabIndex >= 0;
      if (!isButton && !isLink && !isFocusableControl) {
        return null;
      }

      if (element.parentElement?.closest("button, a[href], [role='button']")) {
        return null;
      }

      if (
        !getButtonLabels(element).some(isWithdrawLabel) ||
        !isEnabled(element)
      ) {
        return null;
      }

      if (!isVisible(element)) {
        return null;
      }

      const { row, profileLink } = getInvitationContext(element);
      const profileUrl = profileLink?.href || "";
      const key = profileUrl
        ? new URL(profileUrl).pathname.replace(/\/+$/, "")
        : `${location.pathname}:${normalizeText(row?.innerText || element.innerText || "")}:${index}`;

      return {
        element,
        row: row ?? element.parentElement,
        key,
        profileUrl,
        name: profileLink?.innerText?.trim() || "profile",
      };
    })
    .filter(Boolean)
    .filter(
      (item) =>
        !withdrawState.processed.has(item.key) &&
        (withdrawState.retryAfter.get(item.key) ?? 0) <= Date.now(),
    );
}

function findWithdrawDialog() {
  return Array.from(
    document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], [aria-modal="true"], .artdeco-modal, [data-test-modal]',
    ),
  ).find(isVisible);
}

function findConfirmWithdrawButton(dialog) {
  return Array.from(dialog.querySelectorAll('button, [role="button"]')).find(
    (element) =>
      element instanceof HTMLElement &&
      isVisible(element) &&
      isEnabled(element) &&
      getButtonLabels(element).some(isWithdrawLabel),
  );
}

function waitFor(check, timeoutMs, intervalMs = 100) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const poll = () => {
      const result = check();
      if (result || Date.now() - startedAt >= timeoutMs) {
        resolve(result || null);
        return;
      }
      window.setTimeout(poll, intervalMs);
    };
    poll();
  });
}

let invitationInterval = null;

function stopWithdrawScript() {
  invitationObserver.disconnect();
  if (invitationInterval) {
    clearInterval(invitationInterval);
    invitationInterval = null;
  }
}

async function processWithdrawQueue() {
  if (!isExtensionValid()) {
    stopWithdrawScript();
    return;
  }

  if (!isInvitationPage() || !isSentInvitationPage()) {
    return;
  }

  const result = await safeReadSettings();
  const settings = result.settings;

  if (settings.paused || !settings.withdrawEnabled) {
    return;
  }

  if (withdrawState.lock) {
    return;
  }

  withdrawState.lock = true;

  try {
    const buttons = findWithdrawButtons();
    if (buttons.length === 0) {
      if (Date.now() - withdrawState.lastNoButtonsLogAt > 15000) {
        console.info(
          "No withdraw buttons detected on the sent invitations page",
          {
            path: location.pathname,
            interactiveElements: document.querySelectorAll(
              'button, a[href], [role="button"]',
            ).length,
          },
        );
        withdrawState.lastNoButtonsLogAt = Date.now();
      }
      return;
    }

    for (const item of buttons) {
      if (!isExtensionValid()) {
        stopWithdrawScript();
        return;
      }

      const currentSettings = await safeReadSettings();
      if (
        currentSettings.settings.paused ||
        !currentSettings.settings.withdrawEnabled
      ) {
        return;
      }

      if (
        !item.element.isConnected ||
        !isEnabled(item.element) ||
        !getButtonLabels(item.element).some(isWithdrawLabel)
      ) {
        continue;
      }

      if (findWithdrawDialog()) {
        withdrawState.retryAfter.set(item.key, Date.now() + 30000);
        console.warn("A dialog is already open; skipping withdrawal", item.key);
        continue;
      }

      item.element.scrollIntoView({ block: "center", inline: "center" });
      item.element.click();

      const dialog = await waitFor(findWithdrawDialog, 3000, 25);
      const confirmButton = dialog && findConfirmWithdrawButton(dialog);
      if (!confirmButton) {
        withdrawState.retryAfter.set(item.key, Date.now() + 30000);
        console.warn(
          "Withdrawal confirmation dialog/button was not found",
          item.key,
        );
        continue;
      }

      confirmButton.click();
      const completed = await waitFor(
        () =>
          !item.element.isConnected ||
          !item.row?.isConnected ||
          !getButtonLabels(item.element).some(isWithdrawLabel),
        8000,
      );
      if (!completed) {
        withdrawState.retryAfter.set(item.key, Date.now() + 30000);
        console.warn(
          "Withdrawal was not confirmed in the invitation list",
          item.key,
        );
        continue;
      }

      const response = await safeSendMessage({
        type: "INVITATION_DETECTED",
        payload: {
          id: item.key,
          name: item.name,
          profileUrl: item.profileUrl,
          withdrawnAt: Date.now(),
          status: "withdrawn",
        },
      });
      if (!response?.success) {
        throw new Error(
          response?.error ?? "Could not update the withdrawal counter",
        );
      }

      withdrawState.processed.add(item.key);
      withdrawState.retryAfter.delete(item.key);
      console.info("Invitation withdrawal counted", {
        profileUrl: item.profileUrl,
      });
    }
  } finally {
    withdrawState.lock = false;
  }
}

const invitationObserver = new MutationObserver(() => {
  if (!isExtensionValid()) {
    stopWithdrawScript();
    return;
  }
  window.setTimeout(() => {
    void processWithdrawQueue().catch((error) => {
      console.error("Could not process invitation withdrawals", error);
    });
  }, 400);
});

if (document.body) {
  invitationObserver.observe(document.body, { childList: true, subtree: true });
}

invitationInterval = window.setInterval(() => {
  void processWithdrawQueue().catch((error) => {
    console.error("Could not process invitation withdrawals", error);
  });
}, 4000);
