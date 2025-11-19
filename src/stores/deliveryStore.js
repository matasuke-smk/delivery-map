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
  isNavigating: false,
  currentStepIndex: 0,
  mapPitch: 60, // 地図の角度（0-85度）
  voiceVolume: 1.0, // 音声音量（0.0-1.0）
  currentLocationIcon: null, // 現在位置のカスタムアイコン（画像URL）

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

  // ナビゲーション開始・終了
  startNavigation: () => set({ isNavigating: true, currentStepIndex: 0 }),
  stopNavigation: () => set({ isNavigating: false, currentStepIndex: 0, currentRoute: null, destination: null }),
  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),

  // 地図角度設定
  setMapPitch: (pitch) => set({ mapPitch: pitch }),

  // 音声音量設定
  setVoiceVolume: (volume) => set({ voiceVolume: volume }),

  // 現在位置アイコン設定
  setCurrentLocationIcon: (iconUrl) => set({ currentLocationIcon: iconUrl }),

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
