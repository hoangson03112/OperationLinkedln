import React, { useEffect, useState } from 'react';

const defaultSettings = {
  connectEnabled: true,
  withdrawEnabled: true,
  maxActionsPerRun: 6,
  paused: false,
};

const defaultState = {
  connectStatus: 'idle',
  withdrawStatus: 'idle',
  connectCount: 0,
  withdrawCount: 0,
};

export default function App() {
  const [settings, setSettings] = useState(defaultSettings);
  const [state, setState] = useState(defaultState);
  const [statusText, setStatusText] = useState('Chưa bắt đầu');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const result = await chrome.storage.local.get(['settings', 'state']);

    if (result.settings) {
      setSettings({ ...defaultSettings, ...result.settings });
    }

    if (result.state) {
      setState({ ...defaultState, ...result.state });
    }
  }

  async function updateSetting(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await chrome.storage.local.set({ settings: next });
  }

  useEffect(() => {
    if (settings.paused) {
      setStatusText('Tạm dừng');
      return;
    }

    if (settings.connectEnabled || settings.withdrawEnabled) {
      setStatusText('Đang chạy');
      return;
    }

    setStatusText('Chưa bắt đầu');
  }, [settings.connectEnabled, settings.withdrawEnabled, settings.paused]);

  async function resetStats() {
    const nextState = {
      ...defaultState,
      connectStatus: 'idle',
      withdrawStatus: 'idle',
    };

    setState(nextState);
    await chrome.storage.local.set({
      state: nextState,
      candidates: [],
      invitations: [],
    });
  }

  return React.createElement(
    'main',
    { className: 'popup' },
    React.createElement('h1', null, 'Connection Manager'),
    React.createElement(
      'div',
      { className: 'status-badge', 'data-state': settings.paused ? 'paused' : settings.connectEnabled || settings.withdrawEnabled ? 'running' : 'idle' },
      statusText,
    ),
    React.createElement(
      'section',
      null,
      React.createElement('h2', null, 'Kết nối'),
      React.createElement(
        'button',
        { onClick: () => updateSetting({ connectEnabled: !settings.connectEnabled }) },
        settings.connectEnabled ? 'Đang bật' : 'Bật chức năng',
      ),
      React.createElement('p', null, 'Đã xử lý: ', state.connectCount),
    ),
    React.createElement(
      'section',
      null,
      React.createElement('h2', null, 'Thu hồi lời mời'),
      React.createElement(
        'button',
        { onClick: () => updateSetting({ withdrawEnabled: !settings.withdrawEnabled }) },
        settings.withdrawEnabled ? 'Đang bật' : 'Bật chức năng',
      ),
      React.createElement('p', null, 'Đã thu hồi: ', state.withdrawCount),
    ),
    React.createElement(
      'section',
      null,
      React.createElement('label', null, 'Số thao tác tối đa mỗi lần'),
      React.createElement('input', {
        type: 'number',
        min: 1,
        max: 20,
        value: settings.maxActionsPerRun,
        onChange: async (event) => {
          const value = Number(event.target.value) || 1;
          await updateSetting({ maxActionsPerRun: Math.min(20, Math.max(1, value)) });
        },
      }),
    ),
    React.createElement(
      'section',
      null,
      React.createElement(
        'button',
        { onClick: () => updateSetting({ paused: !settings.paused }) },
        settings.paused ? 'Tiếp tục' : 'Tạm dừng',
      ),
      React.createElement(
        'button',
        { onClick: resetStats, style: { marginTop: '8px' } },
        'Reset bộ đếm',
      ),
    ),
  );
}
