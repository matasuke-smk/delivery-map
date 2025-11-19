import React, { useEffect, useState } from 'react';
import Map from './components/Map';
import useDeliveryStore from './stores/deliveryStore';
import locationTracker from './services/locationTracker';

function App() {
  const { loadData, showTraffic, toggleTraffic, useTollRoads, toggleTollRoads, mapPitch, setMapPitch, voiceVolume, setVoiceVolume, currentLocationIcon, setCurrentLocationIcon } = useDeliveryStore();
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

              {/* 地図の角度 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="mb-3">
                  <div className="font-semibold text-gray-900">地図の角度</div>
                  <div className="text-sm text-gray-500">ナビ中の地図の傾き（0°=真上、60°=斜め）</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-8">0°</span>
                  <input
                    type="range"
                    min="0"
                    max="85"
                    step="5"
                    value={mapPitch}
                    onChange={(e) => setMapPitch(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 w-8">85°</span>
                </div>
                <div className="text-center mt-2">
                  <span className="text-lg font-bold text-blue-600">{mapPitch}°</span>
                </div>
              </div>

              {/* 音声音量 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="mb-3">
                  <div className="font-semibold text-gray-900">音声案内の音量</div>
                  <div className="text-sm text-gray-500">ナビ中の音声案内の音量レベル</div>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={voiceVolume}
                    onChange={(e) => setVoiceVolume(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-center mt-2">
                  <span className="text-lg font-bold text-purple-600">{Math.round(voiceVolume * 100)}%</span>
                </div>
              </div>

              {/* 現在位置アイコン */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="mb-3">
                  <div className="font-semibold text-gray-900">現在位置アイコン</div>
                  <div className="text-sm text-gray-500">地図上の現在位置マーカーの画像を変更</div>
                </div>
                <div className="flex items-center gap-3">
                  {currentLocationIcon && (
                    <div className="w-12 h-12 rounded-full border-2 border-white shadow-md" style={{
                      backgroundImage: `url(${currentLocationIcon})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setCurrentLocationIcon(reader.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="flex-1 text-sm text-gray-700"
                  />
                  {currentLocationIcon && (
                    <button
                      onClick={() => setCurrentLocationIcon(null)}
                      className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                    >
                      リセット
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
