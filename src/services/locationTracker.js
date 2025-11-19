import { Geolocation } from '@capacitor/geolocation';
import useDeliveryStore from '../stores/deliveryStore';

class LocationTracker {
  constructor() {
    this.watchId = null;
    this.lastPosition = null;
    this.stopDuration = 0;
    this.stopThreshold = 180000; // 3分
    this.lastMoveTime = Date.now();
  }

  async startTracking() {
    try {
      // 権限チェック
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          console.error('位置情報の権限が拒否されました');
          return;
        }
      }

      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        },
        (position) => this.handlePositionUpdate(position)
      );

      useDeliveryStore.getState().setTrackingStatus('tracking');
    } catch (error) {
      console.error('位置追跡エラー:', error);
    }
  }

  handlePositionUpdate(position) {
    if (!position?.coords) return;

    const { coords } = position;
    const store = useDeliveryStore.getState();

    // 現在位置更新
    store.setCurrentLocation({
      lat: coords.latitude,
      lng: coords.longitude
    });

    // 移動/停止判定
    if (this.lastPosition) {
      const distance = this.calculateDistance(this.lastPosition, coords);

      if (distance < 5) { // 5m以下は停止とみなす
        if (Date.now() - this.lastMoveTime > this.stopThreshold) {
          // 3分以上停止 = 店舗として記録
          this.detectStore(coords);
          this.lastMoveTime = Date.now();
        }
      } else {
        this.lastMoveTime = Date.now();
      }
    }

    this.lastPosition = coords;
  }

  detectStore(coords) {
    useDeliveryStore.getState().addOrUpdateStore({
      lat: coords.latitude,
      lng: coords.longitude
    });
    console.log('店舗を検出しました:', coords);
  }

  calculateDistance(pos1, pos2) {
    const R = 6371e3; // 地球の半径（メートル）
    const φ1 = pos1.latitude * Math.PI/180;
    const φ2 = pos2.latitude * Math.PI/180;
    const Δφ = (pos2.latitude - pos1.latitude) * Math.PI/180;
    const Δλ = (pos2.longitude - pos1.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  stopTracking() {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
    useDeliveryStore.getState().setTrackingStatus('idle');
  }
}

export default new LocationTracker();
