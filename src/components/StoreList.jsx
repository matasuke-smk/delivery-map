import React from 'react';
import useDeliveryStore from '../stores/deliveryStore';

function StoreList() {
  const { stores } = useDeliveryStore();

  const sortedStores = Array.from(stores.values())
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 20); // TOP20

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4">
      <h2 className="text-xl font-bold mb-4 sticky top-0 bg-gray-50 py-2">
        🏪 よく行く店舗 TOP{sortedStores.length}
      </h2>

      {sortedStores.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          配達を開始すると店舗が記録されます
        </div>
      ) : (
        <div className="space-y-2">
          {sortedStores.map((store, index) => (
            <div key={store.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">#{index + 1}</span>
                    <p className="font-semibold text-sm">
                      📍 {store.location.lat.toFixed(4)}, {store.location.lng.toFixed(4)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    最終訪問: {new Date(store.lastVisit).toLocaleString('ja-JP')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{store.visitCount}</p>
                  <p className="text-xs text-gray-600">訪問</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StoreList;
