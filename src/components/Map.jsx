import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import useDeliveryStore from '../stores/deliveryStore';

// Mapboxトークン設定
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

function Map({ onOpenSettings }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [isOverviewMode, setIsOverviewMode] = React.useState(false);
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
  const lastSpokenStep = useRef(-1);

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
          padding: { top: 80, bottom: 250, left: 50, right: 50 }
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

  // 2点間の方位角を計算（度数法、北が0度）
  const calculateBearing = (point1, point2) => {
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return (θ * 180 / Math.PI + 360) % 360;
  };

  // 音声案内
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      // 既存の音声を停止
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleStartNavigation = () => {
    if (currentRoute && destination) {
      startNavigation();
      lastSpokenStep.current = -1;
      setIsOverviewMode(false);

      // 最初の案内を音声で
      const firstStep = currentRoute.legs[0].steps[0];
      speak(`ナビゲーションを開始します。${firstStep.maneuver.instruction}`);

      // カメラを現在位置中心に、進行方向を上に、現在位置を画面下から2/5に
      if (map.current && currentLocation) {
        const nextPoint = {
          lat: firstStep.maneuver.location[1],
          lng: firstStep.maneuver.location[0]
        };
        const bearing = calculateBearing(currentLocation, nextPoint);

        // 画面の高さを取得してpaddingを計算（現在位置が下から2/5の位置）
        const mapHeight = map.current.getContainer().offsetHeight;
        const bottomPadding = mapHeight * 0.4; // 下部40%をパディング

        map.current.flyTo({
          center: [currentLocation.lng, currentLocation.lat],
          zoom: 17,
          pitch: 60,
          bearing: bearing,
          padding: { top: 0, bottom: bottomPadding, left: 0, right: 0 },
          duration: 2000
        });
      }
    }
  };

  const toggleOverviewMode = () => {
    if (!currentRoute || !currentLocation) return;

    if (isOverviewMode) {
      // ズームモードに戻る
      const steps = currentRoute.legs[0].steps;
      const currentStep = steps[currentStepIndex];
      const nextPoint = {
        lat: currentStep.maneuver.location[1],
        lng: currentStep.maneuver.location[0]
      };
      const bearing = calculateBearing(currentLocation, nextPoint);
      const mapHeight = map.current.getContainer().offsetHeight;
      const bottomPadding = mapHeight * 0.4;

      map.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 17,
        pitch: 60,
        bearing: bearing,
        padding: { top: 0, bottom: bottomPadding, left: 0, right: 0 },
        duration: 1000
      });
      setIsOverviewMode(false);
    } else {
      // 全体表示モード
      const coordinates = currentRoute.geometry.coordinates;
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 200, left: 50, right: 50 },
        pitch: 0,
        bearing: 0,
        duration: 1000
      });
      setIsOverviewMode(true);
    }
  };

  const handleStopNavigation = () => {
    // 音声停止
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    stopNavigation();
    lastSpokenStep.current = -1;

    // カメラをリセット
    if (map.current && routeMarker.current) {
      routeMarker.current.remove();
      routeMarker.current = null;
    }
    if (map.current && map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // カメラを通常視点に
    if (map.current) {
      map.current.easeTo({
        pitch: 0,
        bearing: 0,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        duration: 1000
      });
    }
  };

  // ナビゲーション中の位置追跡
  useEffect(() => {
    if (!isNavigating || !currentRoute || !currentLocation) return;

    const steps = currentRoute.legs[0].steps;
    if (currentStepIndex >= steps.length) {
      // 到着
      speak('目的地に到着しました');
      setTimeout(() => {
        // 音声停止
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        stopNavigation();

        // カメラリセット
        if (map.current && routeMarker.current) {
          routeMarker.current.remove();
          routeMarker.current = null;
        }
        if (map.current && map.current.getSource('route')) {
          map.current.removeLayer('route');
          map.current.removeSource('route');
        }
        if (map.current) {
          map.current.easeTo({
            pitch: 0,
            bearing: 0,
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
            duration: 1000
          });
        }
      }, 2000);
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
      const newStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(newStepIndex);

      // 新しいステップの音声案内
      if (lastSpokenStep.current !== newStepIndex) {
        const nextStep = steps[newStepIndex];
        const distanceText = nextStep.distance < 1000
          ? `${Math.round(nextStep.distance)}メートル先`
          : `${(nextStep.distance / 1000).toFixed(1)}キロ先`;

        speak(`${distanceText}、${nextStep.maneuver.instruction}`);
        lastSpokenStep.current = newStepIndex;
      }
    }

    // 100m以内なら音声で距離を案内
    if (distance < 100 && distance > 30 && lastSpokenStep.current !== currentStepIndex) {
      speak(`${Math.round(distance)}メートル先、${currentStep.maneuver.instruction}`);
      lastSpokenStep.current = currentStepIndex;
    }

    // カメラを現在位置追従、進行方向を上に（Google Mapsスタイル）
    // 全体表示モードでは追従しない
    if (map.current && !isOverviewMode) {
      const bearing = calculateBearing(currentLocation, nextPoint);
      const mapHeight = map.current.getContainer().offsetHeight;
      const bottomPadding = mapHeight * 0.4;

      map.current.easeTo({
        center: [currentLocation.lng, currentLocation.lat],
        bearing: bearing,
        padding: { top: 0, bottom: bottomPadding, left: 0, right: 0 },
        duration: 1000,
        easing: (t) => t // リニア補間でスムーズに
      });
    }
  }, [currentLocation, isNavigating, currentStepIndex, isOverviewMode, stopNavigation]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />

      {/* 設定アイコン（左上） */}
      <button
        onClick={onOpenSettings}
        className="absolute top-4 left-4 p-3 rounded-full bg-white shadow-lg hover:bg-gray-100 transition-colors z-10"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* ナビゲーション中のUI（画面下） */}
      {isNavigating && currentRoute && currentLocation && (
        <div className="absolute bottom-0 left-0 right-0 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {(() => {
            const steps = currentRoute.legs[0].steps;
            const currentStep = steps[currentStepIndex];

            // 残りの総距離を計算
            let remainingDistance = 0;
            for (let i = currentStepIndex; i < steps.length; i++) {
              remainingDistance += steps[i].distance;
            }

            // 残り時間を計算（現在のステップ以降の時間）
            let remainingDuration = 0;
            for (let i = currentStepIndex; i < steps.length; i++) {
              remainingDuration += steps[i].duration;
            }

            return (
              <div className="bg-white shadow-lg">
                <div
                  onClick={toggleOverviewMode}
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer active:bg-gray-50 transition-colors"
                >
                  {/* 残り距離 */}
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-500 mb-1">残り距離</div>
                    <div className="text-lg font-bold text-blue-600">
                      {(remainingDistance / 1000).toFixed(1)} km
                    </div>
                  </div>

                  {/* 終了ボタン */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStopNavigation();
                    }}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors"
                  >
                    終了
                  </button>

                  {/* 到着予定 */}
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-500 mb-1">到着予定</div>
                    <div className="text-lg font-bold text-green-600">
                      {new Date(Date.now() + remainingDuration * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ルート情報（ナビ開始前） */}
      {!isNavigating && currentRoute && (
        <div className="absolute bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center gap-2 px-4 py-3">
            {/* 距離 */}
            <div className="flex-1 text-center">
              <div className="text-xs text-gray-500 mb-1">距離</div>
              <div className="text-lg font-bold text-blue-600">
                {(currentRoute.distance / 1000).toFixed(1)} km
              </div>
            </div>

            {/* 開始ボタン */}
            <button
              onClick={handleStartNavigation}
              className="px-6 py-2 bg-black text-white rounded-lg font-bold hover:bg-gray-800 transition-colors"
            >
              開始
            </button>

            {/* 所要時間 */}
            <div className="flex-1 text-center">
              <div className="text-xs text-gray-500 mb-1">所要時間</div>
              <div className="text-lg font-bold text-green-600">
                {Math.round(currentRoute.duration / 60)} 分
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Map;
