import React, { useEffect, useState } from 'react';
import Map from './components/Map';
import StoreList from './components/StoreList';
import RouteInfo from './components/RouteInfo';
import useDeliveryStore from './stores/deliveryStore';
import locationTracker from './services/locationTracker';

function App() {
  const [activeTab, setActiveTab] = useState('map');
  const { loadData, trackingStatus, setTrackingStatus } = useDeliveryStore();
  const [isLoading, setIsLoading] = useState(true);

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

  const toggleTracking = async () => {
    if (trackingStatus === 'tracking') {
      locationTracker.stopTracking();
    } else {
      await locationTracker.startTracking();
    }
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
      {/* ヘッダー */}
      <header className="bg-black text-white p-4 flex justify-between items-center shadow-lg flex-shrink-0">
        <h1 className="text-xl font-bold">🏍️ 配達マップ</h1>
        <button
          onClick={toggleTracking}
          className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700"
        >
          <div className={`w-3 h-3 rounded-full ${
            trackingStatus === 'tracking' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-sm">
            {trackingStatus === 'tracking' ? '追跡中' : '停止中'}
          </span>
        </button>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        <div className={`absolute inset-0 transition-transform duration-300 ${
          activeTab === 'map' ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <Map />
        </div>

        <div className={`absolute inset-0 transition-transform duration-300 ${
          activeTab === 'stores' ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <StoreList />
        </div>

        <div className={`absolute inset-0 transition-transform duration-300 ${
          activeTab === 'route' ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <RouteInfo />
        </div>
      </main>

      {/* タブバー */}
      <nav className="bg-white border-t flex shadow-lg flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-4 transition-colors ${
            activeTab === 'map'
              ? 'bg-black text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="text-center">
            <div className="text-xl mb-1">🗺️</div>
            <div className="text-xs">地図</div>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('stores')}
          className={`flex-1 py-4 transition-colors ${
            activeTab === 'stores'
              ? 'bg-black text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="text-center">
            <div className="text-xl mb-1">📍</div>
            <div className="text-xs">店舗</div>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('route')}
          className={`flex-1 py-4 transition-colors ${
            activeTab === 'route'
              ? 'bg-black text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="text-center">
            <div className="text-xl mb-1">📊</div>
            <div className="text-xs">分析</div>
          </div>
        </button>
      </nav>
    </div>
  );
}

export default App;
