import React, { useEffect, useState } from 'react';
import Map from './components/Map';
import useDeliveryStore from './stores/deliveryStore';
import locationTracker from './services/locationTracker';

function App() {
  const { loadData, showTraffic, toggleTraffic, useTollRoads, toggleTollRoads } = useDeliveryStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // データ読み込み
      await loadData();

      // 自動追跡開始
      await startAutoTracking();
    } catch (error) {
      console.error('初期化エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startAutoTracking = async () => {
    await locationTracker.startTracking();
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-100" style={{ height: '100vh', height: '100dvh' }}>
      {/* メインコンテンツ */}
      <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        <Map onOpenSettings={() => setShowSettings(true)} />
      </main>

      {/* 設定モーダル */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-lg p-6 m-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">設定</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* 交通状況 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900">交通状況</div>
                  <div className="text-sm text-gray-500">リアルタイム渋滞情報を表示</div>
                </div>
                <button
                  onClick={toggleTraffic}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    showTraffic ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    showTraffic ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* 有料道路 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900">有料道路</div>
                  <div className="text-sm text-gray-500">高速道路・有料道路を使用</div>
                </div>
                <button
                  onClick={toggleTollRoads}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    useTollRoads ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    useTollRoads ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
