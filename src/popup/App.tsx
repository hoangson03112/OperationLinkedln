import { useEffect, useState } from 'react';

import type {
  AutomationSettings,
  AutomationState
} from '../types';

export default function App() {
  const [settings, setSettings] =
    useState<AutomationSettings>({
      connectEnabled: false,
      withdrawEnabled: false,
      maxActionsPerRun: 20
    });

  const [state, setState] =
    useState<AutomationState>({
      connectStatus: 'idle',
      withdrawStatus: 'idle',
      connectCount: 0,
      withdrawCount: 0
    });

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const result =
      await chrome.storage.local.get([
        'settings',
        'state'
      ]);

    if (result.settings) {
      setSettings(result.settings);
    }

    if (result.state) {
      setState(result.state);
    }
  }

  async function toggleConnect() {
    const value = !settings.connectEnabled;

    const next = {
      ...settings,
      connectEnabled: value
    };

    setSettings(next);

    await chrome.storage.local.set({
      settings: next
    });
  }

  async function toggleWithdraw() {
    const value = !settings.withdrawEnabled;

    const next = {
      ...settings,
      withdrawEnabled: value
    };

    setSettings(next);

    await chrome.storage.local.set({
      settings: next
    });
  }

  return (
    <main className="popup">
      <h1>Connection Manager</h1>

      <section>
        <h2>Kết nối</h2>

        <button onClick={toggleConnect}>
          {settings.connectEnabled
            ? 'Đang bật'
            : 'Bật chức năng'}
        </button>

        <p>
          Đã xử lý: {state.connectCount}
        </p>
      </section>

      <section>
        <h2>Thu hồi lời mời</h2>

        <button onClick={toggleWithdraw}>
          {settings.withdrawEnabled
            ? 'Đang bật'
            : 'Bật chức năng'}
        </button>

        <p>
          Đã thu hồi: {state.withdrawCount}
        </p>
      </section>

      <section>
        <label>
          Số thao tác tối đa mỗi lần
        </label>

        <input
          type="number"
          min={1}
          max={100}
          value={settings.maxActionsPerRun}
          onChange={async event => {
            const value = Number(
              event.target.value
            );

            const next = {
              ...settings,
              maxActionsPerRun: value
            };

            setSettings(next);

            await chrome.storage.local.set({
              settings: next
            });
          }}
        />
      </section>
    </main>
  );
}