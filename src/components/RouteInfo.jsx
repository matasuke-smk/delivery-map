import React from 'react';
import useDeliveryStore from '../stores/deliveryStore';

function RouteInfo() {
  const {
    routes,
    trackingStatus,
    currentRoute,
    destination,
    showTraffic,
    toggleTraffic
  } = useDeliveryStore();

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4">
      <h2 className="text-xl font-bold mb-4">🛣️ ルート分析</h2>

      {/* 現在のルート情報 */}
      {currentRoute && (
        <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-lg shadow mb-4">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span className="text-2xl">🗺️</span>
            現在のルート
          </h3>

          <div className="space-y-3">
            <div className="bg-white p-3 rounded">
              <div className="text-sm text-gray-600 mb-1">距離</div>
              <div className="text-2xl font-bold text-blue-600">
                {(currentRoute.distance / 1000).toFixed(2)} km
              </div>
            </div>

            <div className="bg-white p-3 rounded">
              <div className="text-sm text-gray-600 mb-1">所要時間</div>
              <div className="text-2xl font-bold text-green-600">
                {Math.round(currentRoute.duration / 60)} 分
              </div>
            </div>

            <div className="bg-white p-3 rounded">
              <div className="text-sm text-gray-600 mb-1">ターン数</div>
              <div className="text-xl font-bold text-gray-700">
                {currentRoute.legs[0].steps.length} 回
              </div>
            </div>

            {destination && (
              <div className="bg-white p-3 rounded">
                <div className="text-sm text-gray-600 mb-1">目的地</div>
                <div className="text-sm font-mono text-gray-700">
                  {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 交通状況切り替え */}
      <div className="bg-white p-6 rounded-lg shadow mb-4">
        <h3 className="font-semibold mb-3">交通状況表示</h3>
        <button
          onClick={toggleTraffic}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
            showTraffic
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          }`}
        >
          {showTraffic ? '✅ 表示中' : '❌ 非表示'}
        </button>

        {showTraffic && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-green-500 rounded"></div>
              <span>スムーズ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-yellow-500 rounded"></div>
              <span>やや混雑</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-orange-600 rounded"></div>
              <span>混雑</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-red-600 rounded"></div>
              <span>渋滞</span>
            </div>
          </div>
        )}
      </div>

      {/* 追跡状態 */}
      <div className="bg-white p-6 rounded-lg shadow mb-4">
        <h3 className="font-semibold mb-2">追跡状態</h3>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            trackingStatus === 'tracking' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <span>{trackingStatus === 'tracking' ? '位置情報を追跡中' : '追跡停止中'}</span>
        </div>
      </div>

      {/* 機能説明 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="font-semibold mb-2">機能説明</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• 地図をクリックでルート検索</li>
          <li>• 交通状況をリアルタイム表示</li>
          <li>• 3分以上停止で店舗記録</li>
          <li>• バックグラウンド追跡対応</li>
          <li>• データは端末に保存</li>
        </ul>
      </div>

      {routes.length > 0 && (
        <div className="mt-4 bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-2">ルート履歴</h3>
          <p className="text-sm text-gray-600">
            {routes.length}件のルート履歴
          </p>
        </div>
      )}
    </div>
  );
}

export default RouteInfo;
