import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';

const useDeliveryStore = create((set, get) => ({
  // 状態
  stores: new Map(),
  currentLocation: null,
  trackingStatus: 'idle',
  routes: [],
  currentRoute: null,
  destination: null,
  showTraffic: false,
  useTollRoads: false,

  // 位置更新
  setCurrentLocation: (location) => set({ currentLocation: location }),

  // 追跡状態
  setTrackingStatus: (status) => set({ trackingStatus: status }),

  // ルート設定
  setCurrentRoute: (route) => set({ currentRoute: route }),

  // 目的地設定
  setDestination: (location) => set({ destination: location }),

  // 交通状況表示切り替え
  toggleTraffic: () => set((state) => ({ showTraffic: !state.showTraffic })),

  // 有料道路使用切り替え
  toggleTollRoads: () => set((state) => ({ useTollRoads: !state.useTollRoads })),

  // 店舗管理
  addOrUpdateStore: async (location) => {
    const { stores } = get();
    const storeKey = `${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;

    if (stores.has(storeKey)) {
      const store = stores.get(storeKey);
      store.visitCount++;
      store.lastVisit = new Date();
    } else {
      stores.set(storeKey, {
        id: storeKey,
        location,
        visitCount: 1,
        firstVisit: new Date(),
        lastVisit: new Date(),
        avgWaitTime: 0,
        name: null
      });
    }

    set({ stores: new Map(stores) });
    await get().saveData();
  },

  // データ永続化
  saveData: async () => {
    const { stores, routes } = get();
    try {
      await Preferences.set({
        key: 'delivery_stores',
        value: JSON.stringify(Array.from(stores.entries()))
      });
      await Preferences.set({
        key: 'delivery_routes',
        value: JSON.stringify(routes)
      });
    } catch (error) {
      console.error('データ保存エラー:', error);
    }
  },

  // データ読み込み
  loadData: async () => {
    try {
      const storesData = await Preferences.get({ key: 'delivery_stores' });
      const routesData = await Preferences.get({ key: 'delivery_routes' });

      if (storesData?.value) {
        const stores = new Map(JSON.parse(storesData.value));
        set({ stores });
      }
      if (routesData?.value) {
        set({ routes: JSON.parse(routesData.value) });
      }
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    }
  }
}));

export default useDeliveryStore;
