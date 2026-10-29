import { useEffect, useState } from 'react';

import type {
  AutomationSettings,
  AutomationState
} from '../types';

type PageMode = 'connect' | 'withdraw' | 'unsupported';

const defaultSettings: AutomationSettings = {
  connectEnabled: false,
  withdrawEnabled: false,
  maxActionsPerRun: 20,
  paused: false
};

const defaultState: AutomationState = {
  connectStatus: 'idle',
  withdrawStatus: 'idle',
  connectCount: 0,
  withdrawCount: 0
};

export default function App() {
  const [settings, setSettings] = useState(defaultSettings);
  const [state, setState] = useState(defaultState);
  const [pageMode, setPageMode] = useState<PageMode>('unsupported');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadData();

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') {
        return;
      }

      if (changes.state?.newValue) {
        setState({
          ...defaultState,
          ...changes.state.newValue
        });
      }

      if (changes.settings?.newValue) {
        setSettings({
          ...defaultSettings,
          ...changes.settings.newValue
        });
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }

    return undefined;
  }, []);

  async function loadData() {
    try {
      const [stored, page] = await Promise.all([
        chrome.storage.local.get(['settings', 'state']),
        chrome.runtime.sendMessage({ type: 'GET_PAGE_TYPE' })
      ]);

      setSettings({
        ...defaultSettings,
        ...stored.settings
      });
      setState({
        ...defaultState,
        ...stored.state
      });
      setPageMode(
        page?.page === 'connect' || page?.page === 'withdraw'
          ? page.page
          : 'unsupported'
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải trạng thái extension'
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateSetting(patch: Partial<AutomationSettings>) {
    const next = {
      ...settings,
      ...patch
    };

    try {
      await chrome.storage.local.set({ settings: next });
      setSettings(next);
      setError('');
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Không thể lưu cài đặt'
      );
    }
  }

  async function updateMaxActionsPerRun(value: number) {
    const next = {
      ...settings,
      maxActionsPerRun: value
    };

    try {
      await chrome.storage.local.set({ settings: next });
      setSettings(next);
      setError('');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Không thể lưu cài đặt'
      );
    }
  }

  const connectEnabled = settings.connectEnabled;
  const withdrawEnabled = settings.withdrawEnabled;
  const featureEnabled =
    pageMode === 'connect'
      ? connectEnabled
      : pageMode === 'withdraw'
        ? withdrawEnabled
        : false;
  const modeEnabled = featureEnabled && !settings.paused;

  return (
    <main className="popup">
      <header className="popup-header">
        <div className="brand-icon" aria-hidden="true">CM</div>
        <div>
          <p className="eyebrow">LINKEDIN TOOLS</p>
          <h1>Connection Manager</h1>
        </div>
      </header>

      <div
        className="status-badge"
        data-state={
          loading
            ? 'loading'
            : settings.paused && featureEnabled
              ? 'paused'
              : modeEnabled
                ? 'running'
                : 'idle'
        }
        aria-live="polite"
      >
        {loading
          ? 'Đang kiểm tra trang...'
          : settings.paused && featureEnabled
            ? 'Đang tạm dừng'
          : modeEnabled
            ? 'Đã bật trên trang này'
            : 'Đang tắt'}
      </div>

      {pageMode === 'connect' && (
        <section>
          <h2>Gửi lời mời kết nối</h2>
          <p className="section-description">Tự gửi lời mời từ các hồ sơ hiển thị trong khu vực mạng lưới.</p>
          <button
            className={connectEnabled ? 'action-button is-enabled' : 'action-button'}
            aria-pressed={connectEnabled}
            disabled={loading}
            onClick={() =>
              void updateSetting({ connectEnabled: !connectEnabled })
            }
          >
            {connectEnabled ? 'Tắt gửi lời mời' : 'Bật gửi lời mời'}
          </button>
          <div className="count-card">
            <span className="count-value">{state.connectCount}</span>
            <span className="count-label">Lời mời đã gửi thành công</span>
          </div>
        </section>
      )}

      {pageMode === 'withdraw' && (
        <section>
          <h2>Thu hồi lời mời đã gửi</h2>
          <p className="section-description">Thu hồi lần lượt các lời mời đang chờ trong danh sách đã gửi.</p>
          <button
            className={withdrawEnabled ? 'action-button is-enabled' : 'action-button'}
            aria-pressed={withdrawEnabled}
            disabled={loading}
            onClick={() =>
              void updateSetting({ withdrawEnabled: !withdrawEnabled })
            }
          >
            {withdrawEnabled ? 'Tắt thu hồi' : 'Bật thu hồi'}
          </button>
          <div className="count-card">
            <span className="count-value">{state.withdrawCount}</span>
            <span className="count-label">Lời mời đã thu hồi thành công</span>
          </div>
          <p className="helper-text">Không giới hạn số lượng. Bộ đếm chỉ tăng sau khi trang xác nhận thu hồi.</p>
        </section>
      )}

      {pageMode === 'unsupported' && !loading && (
        <section>
          <h2>Không có chức năng cho trang này</h2>
          <p className="section-description">
            Mở khu vực mạng lưới để gửi lời mời hoặc danh sách lời mời đã gửi
            để thu hồi.
          </p>
        </section>
      )}

      {error && <p role="alert">{error}</p>}

      {pageMode === 'connect' && (
        <section className="settings-card">
          <label htmlFor="max-actions">Giới hạn lời mời mỗi lượt</label>
          <p className="helper-text">Tối đa 20 thao tác trong một lượt chạy.</p>
          <input
            id="max-actions"
            type="number"
            min={1}
            max={20}
            value={settings.maxActionsPerRun}
            onChange={event =>
              void updateMaxActionsPerRun(
                Math.min(20, Math.max(1, Number(event.target.value) || 1))
              )
            }
          />
        </section>
      )}

      {pageMode !== 'unsupported' && featureEnabled && (
        <button
          className="pause-button"
          onClick={() => void updateSetting({ paused: !settings.paused })}
        >
          {settings.paused ? 'Tiếp tục automation' : 'Tạm dừng automation'}
        </button>
      )}
    </main>
  );
}