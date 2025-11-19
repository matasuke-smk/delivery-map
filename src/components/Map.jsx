import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import useDeliveryStore from '../stores/deliveryStore';

// Mapboxトークン設定
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

function Map() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const {
    stores,
    currentLocation,
    currentRoute,
    setCurrentRoute,
    destination,
    setDestination,
    showTraffic,
    useTollRoads,
    isNavigating,
    currentStepIndex,
    startNavigation,
    stopNavigation,
    setCurrentStepIndex,
    setCurrentLocation
  } = useDeliveryStore();
  const routeMarker = useRef(null);

  useEffect(() => {
    if (map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [135.7681, 35.0116], // 京都
        zoom: 12
      });

      // コントロール追加
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // 現在位置コントロール
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      });

      map.current.addControl(geolocate);

      // GPS位置取得時にストアを更新
      geolocate.on('geolocate', (e) => {
        const newLocation = {
          lat: e.coords.latitude,
          lng: e.coords.longitude
        };
        console.log('🟢 GPS位置取得:', newLocation);
        setCurrentLocation(newLocation);
        console.log('🟢 ストア更新完了');
      });

      geolocate.on('error', (e) => {
        console.error('🔴 GPS取得エラー:', e);
      });

      // マップロード後に現在位置を取得と日本語設定
      map.current.on('load', () => {
        // すべてのテキストレイヤーを日本語に設定
        const layers = map.current.getStyle().layers;
        layers.forEach((layer) => {
          if (layer.layout && layer.layout['text-field']) {
            // 道路番号を含むレイヤーの場合は番号のみ表示
            if (layer.id.includes('road') || layer.id.includes('highway') || layer.id.includes('shield')) {
              const refValue = ['get', 'ref'];
              map.current.setLayoutProperty(
                layer.id,
                'text-field',
                ['case', ['has', 'ref'], refValue, ['coalesce', ['get', 'name_ja'], ['get', 'name_en'], ['get', 'name']]]
              );
            } else {
              // 他のレイヤーは日本語名のみ
              map.current.setLayoutProperty(
                layer.id,
                'text-field',
                ['coalesce', ['get', 'name_ja'], ['get', 'name_en'], ['get', 'name']]
              );
            }
          }
        });

        // 交通状況レイヤーを追加
        map.current.addSource('mapbox-traffic', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-traffic-v1'
        });

        map.current.addLayer({
          id: 'traffic',
          type: 'line',
          source: 'mapbox-traffic',
          'source-layer': 'traffic',
          filter: [
            'in',
            ['get', 'class'],
            ['literal', ['motorway', 'trunk', 'primary', 'secondary']]
          ],
          layout: {
            'visibility': 'none'
          },
          paint: {
            'line-width': 4,
            'line-color': [
              'case',
              ['==', ['get', 'congestion'], 'low'], '#4CAF50',
              ['==', ['get', 'congestion'], 'moderate'], '#FFC107',
              ['==', ['get', 'congestion'], 'heavy'], '#FF5722',
              ['==', ['get', 'congestion'], 'severe'], '#D32F2F',
              '#888888'
            ]
          }
        });

        geolocate.trigger();
      });

      // 地図クリックでルート検索
      map.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat;

        console.log('🔵 地図クリック:', { lat, lng });

        // ストアから最新の位置情報を取得
        const storeState = useDeliveryStore.getState();
        console.log('🔵 ストア内のcurrentLocation:', storeState.currentLocation);

        // 目的地マーカーを更新
        if (routeMarker.current) {
          routeMarker.current.remove();
        }

        routeMarker.current = new mapboxgl.Marker({ color: '#3B82F6' })
          .setLngLat([lng, lat])
          .addTo(map.current);

        setDestination({ lat, lng });

        // 現在位置がある場合はルート検索
        if (storeState.currentLocation && storeState.currentLocation.lat && storeState.currentLocation.lng) {
          console.log('🔵 ルート検索開始');
          await searchRoute(storeState.currentLocation, { lat, lng });
        } else {
          console.warn('🔴 現在位置が取得できていません');
          alert('現在位置が取得できていません。位置情報を許可してから、地図の現在位置ボタンをクリックしてください。');
        }
      });
    } catch (error) {
      console.error('マップ初期化エラー:', error);
    }
  }, []);

  // ルート検索関数
  const searchRoute = async (origin, destination) => {
    try {
      const storeState = useDeliveryStore.getState();
      const excludeParam = storeState.useTollRoads ? '' : '&exclude=toll';
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=${mapboxgl.accessToken}&language=ja&alternatives=true&steps=true&overview=full${excludeParam}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setCurrentRoute(route);

        // ルートをマップに描画
        if (map.current.getSource('route')) {
          map.current.getSource('route').setData({
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          });
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3B82F6',
              'line-width': 6,
              'line-opacity': 0.8
            }
          });
        }

        // ルート全体が見えるようにズーム調整
        const coordinates = route.geometry.coordinates;
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.current.fitBounds(bounds, {
          padding: 50
        });

        console.log('ルート情報:', {
          距離: `${(route.distance / 1000).toFixed(2)}km`,
          所要時間: `${Math.round(route.duration / 60)}分`,
          ステップ数: route.legs[0].steps.length
        });
      }
    } catch (error) {
      console.error('ルート検索エラー:', error);
    }
  };

  // 交通状況表示切り替え
  useEffect(() => {
    if (!map.current || !map.current.getLayer('traffic')) return;

    map.current.setLayoutProperty(
      'traffic',
      'visibility',
      showTraffic ? 'visible' : 'none'
    );
  }, [showTraffic]);

  // 有料道路設定変更時にルート再検索
  useEffect(() => {
    if (currentRoute && destination) {
      const storeState = useDeliveryStore.getState();
      if (storeState.currentLocation) {
        searchRoute(storeState.currentLocation, destination);
      }
    }
  }, [useTollRoads]);

  // 店舗マーカー更新
  useEffect(() => {
    if (!map.current) return;

    // 既存マーカーをクリア
    const markers = document.getElementsByClassName('store-marker');
    Array.from(markers).forEach(marker => marker.remove());

    // 店舗マーカー追加
    stores.forEach((store) => {
      const el = document.createElement('div');
      el.className = 'store-marker';
      el.style.width = `${20 + Math.min(store.visitCount * 3, 40)}px`;
      el.style.height = `${20 + Math.min(store.visitCount * 3, 40)}px`;
      el.style.backgroundColor = store.visitCount > 5 ? '#FF4444' : '#FF6B6B';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid white';

      new mapboxgl.Marker(el)
        .setLngLat([store.location.lng, store.location.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <p class="font-bold">訪問回数: ${store.visitCount}回</p>
              <p class="text-sm">初回: ${new Date(store.firstVisit).toLocaleDateString()}</p>
              <p class="text-sm">最終: ${new Date(store.lastVisit).toLocaleDateString()}</p>
            </div>`
          )
        )
        .addTo(map.current);
    });
  }, [stores]);

  // 2点間の距離を計算（メートル）
  const calculateDistance = (point1, point2) => {
    const R = 6371e3; // 地球の半径（メートル）
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleStartNavigation = () => {
    if (currentRoute && destination) {
      startNavigation();
      // カメラを現在位置中心に
      if (map.current && currentLocation) {
        map.current.flyTo({
          center: [currentLocation.lng, currentLocation.lat],
          zoom: 16,
          pitch: 60,
          bearing: 0
        });
      }
    }
  };

  const handleStopNavigation = () => {
    stopNavigation();
    // カメラをリセット
    if (map.current && routeMarker.current) {
      routeMarker.current.remove();
      routeMarker.current = null;
    }
    if (map.current && map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }
  };

  // ナビゲーション中の位置追跡
  useEffect(() => {
    if (!isNavigating || !currentRoute || !currentLocation) return;

    const steps = currentRoute.legs[0].steps;
    if (currentStepIndex >= steps.length) {
      // 到着
      alert('目的地に到着しました！');
      stopNavigation();
      return;
    }

    const currentStep = steps[currentStepIndex];
    const nextPoint = {
      lat: currentStep.maneuver.location[1],
      lng: currentStep.maneuver.location[0]
    };

    const distance = calculateDistance(currentLocation, nextPoint);

    // 次のステップまで30m以内なら次へ
    if (distance < 30 && currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }

    // カメラを現在位置追従
    if (map.current) {
      map.current.easeTo({
        center: [currentLocation.lng, currentLocation.lat],
        duration: 1000
      });
    }
  }, [currentLocation, isNavigating, currentStepIndex]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />

      {/* ナビゲーション中のUI */}
      {isNavigating && currentRoute && currentLocation && (
        <div className="absolute top-0 left-0 right-0 bg-white shadow-lg p-4">
          {(() => {
            const steps = currentRoute.legs[0].steps;
            const currentStep = steps[currentStepIndex];
            const nextPoint = {
              lat: currentStep.maneuver.location[1],
              lng: currentStep.maneuver.location[0]
            };
            const distanceToNext = calculateDistance(currentLocation, nextPoint);

            // 残りの総距離を計算
            let remainingDistance = 0;
            for (let i = currentStepIndex; i < steps.length; i++) {
              remainingDistance += steps[i].distance;
            }

            // 方向アイコンの取得
            const getDirectionIcon = (type) => {
              const icons = {
                'turn-right': '➡️',
                'turn-left': '⬅️',
                'sharp-right': '↗️',
                'sharp-left': '↖️',
                'slight-right': '↗️',
                'slight-left': '↖️',
                'straight': '⬆️',
                'uturn': '🔃',
                'arrive': '🏁'
              };
              return icons[type] || '⬆️';
            };

            return (
              <>
                {/* 次の案内 */}
                <div className="bg-blue-600 text-white p-4 rounded-lg mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{getDirectionIcon(currentStep.maneuver.type)}</div>
                    <div className="flex-1">
                      <div className="text-sm opacity-80">あと {distanceToNext < 1000 ? `${Math.round(distanceToNext)}m` : `${(distanceToNext / 1000).toFixed(1)}km`}</div>
                      <div className="text-lg font-bold">{currentStep.maneuver.instruction}</div>
                    </div>
                  </div>
                </div>

                {/* 残り距離と時間 */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-600">残り距離</div>
                    <div className="text-lg font-bold">{(remainingDistance / 1000).toFixed(1)} km</div>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-600">到着予定</div>
                    <div className="text-lg font-bold">
                      {new Date(Date.now() + currentRoute.duration * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* 終了ボタン */}
                <button
                  onClick={handleStopNavigation}
                  className="w-full bg-red-500 text-white py-2 rounded-lg font-bold hover:bg-red-600 transition-colors"
                >
                  ナビ終了
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* ルート情報（ナビ開始前） */}
      {!isNavigating && currentRoute && (
        <div className="absolute bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          {/* 距離と時間 */}
          <div className="flex gap-4 mb-3">
            <div className="flex-1 bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">距離</div>
              <div className="text-xl font-bold text-blue-600">
                {(currentRoute.distance / 1000).toFixed(1)} km
              </div>
            </div>
            <div className="flex-1 bg-green-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">所要時間</div>
              <div className="text-xl font-bold text-green-600">
                {Math.round(currentRoute.duration / 60)} 分
              </div>
            </div>
          </div>

          {/* 開始ボタン */}
          <button
            onClick={handleStartNavigation}
            className="w-full bg-black text-white py-3 rounded-lg font-bold text-lg hover:bg-gray-800 transition-colors"
          >
            ナビ開始
          </button>
        </div>
      )}
    </div>
  );
}

export default Map;
