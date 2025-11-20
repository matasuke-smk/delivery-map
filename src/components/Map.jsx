import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import useDeliveryStore from '../stores/deliveryStore';
import { reverseGeocode } from '../services/urlParser';

// Mapboxトークン設定
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const Map = forwardRef(({ onOpenSettings, onGeolocateReady }, ref) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [isOverviewMode, setIsOverviewMode] = React.useState(false);
  const [showRecenterButton, setShowRecenterButton] = React.useState(false);
  const [mapError, setMapError] = React.useState(null);
  const [showHelp, setShowHelp] = React.useState(false);
  const userInteracted = useRef(false);
  const [compassHeading, setCompassHeading] = React.useState(null);
  const lastPosition = useRef(null);
  const currentSpeed = useRef(0);
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
    clearRoute,
    setCurrentStepIndex,
    setCurrentLocation,
    mapPitch,
    currentLocationIcon
  } = useDeliveryStore();
  const routeMarker = useRef(null);
  const lastSpokenStep = useRef(-1);
  const currentLocationMarker = useRef(null);

  // 外部から呼び出せるメソッドを定義
  useImperativeHandle(ref, () => ({
    setDestinationFromUrl: async (destinationData) => {
      try {
        // 目的地を設定
        const dest = {
          lat: destinationData.lat,
          lng: destinationData.lng,
          name: destinationData.placeName || `座標: ${destinationData.lat}, ${destinationData.lng}`
        };

        setDestination(dest);

        // マップを目的地に移動
        if (map.current) {
          map.current.flyTo({
            center: [dest.lng, dest.lat],
            zoom: 14,
            duration: 2000
          });

          // マーカーを設定
          if (routeMarker.current) {
            routeMarker.current.setLngLat([dest.lng, dest.lat]);
          } else {
            routeMarker.current = new mapboxgl.Marker({ color: '#FF4444' })
              .setLngLat([dest.lng, dest.lat])
              .setPopup(new mapboxgl.Popup().setHTML(`<p class="font-bold">${dest.name}</p>`))
              .addTo(map.current);
          }

          // 現在地が取得できていればルート検索
          const storeState = useDeliveryStore.getState();
          if (storeState.currentLocation) {
            await searchRoute(storeState.currentLocation, dest);
          } else {
            console.log('現在位置が未取得のため、ルート検索をスキップ');
          }
        }
      } catch (error) {
        console.error('目的地設定エラー:', error);
      }
    }
  }));

  useEffect(() => {
    if (map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [135.7681, 35.0116], // 京都
        zoom: 12
      });

      // コントロール追加（右下に配置）
      const navControl = new mapboxgl.NavigationControl();
      map.current.addControl(navControl, 'bottom-right');

      // 位置情報取得コントロール（マーカーは非表示、位置取得のみ）
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserLocation: false, // デフォルトマーカーを非表示
        showUserHeading: false
      });

      map.current.addControl(geolocate, 'top-right');

      // GPS位置取得時にストアを更新
      geolocate.on('geolocate', (e) => {
        const newLocation = {
          lat: e.coords.latitude,
          lng: e.coords.longitude
        };
        console.log('🟢 GPS位置取得:', newLocation);
        setCurrentLocation(newLocation);
      });

      geolocate.on('error', (e) => {
        console.error('🔴 GPS取得エラー:', e);
      });

      // geolocateコントロールを親コンポーネントに渡す
      if (onGeolocateReady) {
        onGeolocateReady(geolocate);
      }

      // ユーザーのドラッグ操作を検出
      map.current.on('dragstart', () => {
        const storeState = useDeliveryStore.getState();
        if (storeState.isNavigating) {
          userInteracted.current = true;
          setShowRecenterButton(true); // スワイプしたら即座にボタン表示
        }
      });

      // マップロード後に日本語設定
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

        // 交通標識用のアイコンを作成
        const createIcon = (text, bgColor, textColor = '#FFFFFF') => {
          const size = 48; // サイズを48x48に統一
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // 背景円
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2 - 4, 0, 2 * Math.PI);
          ctx.fill();

          // 白枠
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3;
          ctx.stroke();

          // テキスト
          ctx.fillStyle = textColor;
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, size / 2, size / 2);

          // CanvasをImageDataに変換
          return ctx.getImageData(0, 0, size, size);
        };

        // アイコンを登録（信号のみ）
        map.current.addImage('traffic-signal-icon', createIcon('信', '#FF9800'), { pixelRatio: 1 });

        // 交通標識データ用のソースを追加
        map.current.addSource('traffic-signs', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // 信号機レイヤー
        map.current.addLayer({
          id: 'traffic-signals',
          type: 'symbol',
          source: 'traffic-signs',
          filter: ['==', ['get', 'type'], 'traffic_signals'],
          layout: {
            'icon-image': 'traffic-signal-icon',
            'icon-size': 0.6,
            'icon-allow-overlap': true
          },
          minzoom: 14 // ズームレベル14以上で表示
        });

        // Overpass APIから交通標識データを取得
        const fetchTrafficSigns = async () => {
          if (!map.current) return;

          // ズームレベルが14未満の場合は取得しない
          const zoom = map.current.getZoom();
          if (zoom < 14) {
            console.log('🚦 ズームレベルが低いため信号を非表示');
            const source = map.current.getSource('traffic-signs');
            if (source) {
              source.setData({ type: 'FeatureCollection', features: [] });
            }
            return;
          }

          const bounds = map.current.getBounds();
          const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

          // 信号機のみ取得
          const query = `[out:json][bbox:${bbox}][timeout:10];node["highway"="traffic_signals"];out body 500;`;

          try {
            console.log('🚦 信号データ取得開始');
            const response = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: `data=${encodeURIComponent(query)}`
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`🚦 信号取得完了: ${data.elements.length}件`);

            const features = data.elements.map(element => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [element.lon, element.lat]
              },
              properties: {
                type: 'traffic_signals'
              }
            }));

            const source = map.current.getSource('traffic-signs');
            if (source) {
              source.setData({
                type: 'FeatureCollection',
                features: features
              });
            }
          } catch (error) {
            console.error('🔴 信号データの取得に失敗:', error);
          }
        };

        // 初回読み込み
        fetchTrafficSigns();

        // 地図移動時に更新（デバウンス付き）
        let fetchTimeout;
        map.current.on('moveend', () => {
          clearTimeout(fetchTimeout);
          fetchTimeout = setTimeout(fetchTrafficSigns, 500);
        });

        // デフォルトで位置情報を取得
        geolocate.trigger();
      });

      // タッチイベント処理の変数
      let touchStartTime = null;
      let touchStartPosition = null;
      let longPressTimer = null;
      let isLongPress = false;
      let lastTapTime = 0;
      let tapCount = 0;
      let doubleTapTimer = null;
      let touchCount = 0; // マルチタッチ検出用
      const LONG_PRESS_DURATION = 500; // 500ms以上で長押し
      const DOUBLE_TAP_DELAY = 300; // 300ms以内でダブルタップ

      // 長押しでピンを設置（目的地設定）
      const handleLongPress = async (lngLat) => {
        // ナビ中は長押しを無視
        const storeState = useDeliveryStore.getState();
        if (storeState.isNavigating) {
          console.log('🔵 ナビ中のため長押しを無視');
          return;
        }

        const { lng, lat } = lngLat;
        console.log('🔵 長押し検出 - ピン設置:', { lat, lng });

        // バイブレーション（対応デバイスのみ）
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }

        // 目的地マーカーを更新
        if (routeMarker.current) {
          routeMarker.current.remove();
        }

        routeMarker.current = new mapboxgl.Marker({ color: '#3B82F6' })
          .setLngLat([lng, lat])
          .addTo(map.current);

        // リバースジオコーディングで場所名を取得
        let placeName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const geocodeResult = await reverseGeocode(lat, lng, mapboxgl.accessToken);
          if (geocodeResult) {
            placeName = geocodeResult.name || geocodeResult.fullName || placeName;
            console.log('📍 場所名取得:', placeName);
          }
        } catch (error) {
          console.warn('⚠️ リバースジオコーディングエラー:', error);
        }

        setDestination({ lat, lng, name: placeName });

        // 現在位置がある場合はルート検索
        if (storeState.currentLocation && storeState.currentLocation.lat && storeState.currentLocation.lng) {
          console.log('🔵 ルート検索開始');
          await searchRoute(storeState.currentLocation, { lat, lng });
        } else {
          console.warn('🔴 現在位置が取得できていません');
          alert('現在位置が取得できていません。位置情報を許可してから、地図の現在位置ボタンをクリックしてください。');
        }
      };

      // タップでピンをクリア
      const handleSingleTap = () => {
        // ナビ中はタップを無視
        const storeState = useDeliveryStore.getState();
        if (storeState.isNavigating) {
          console.log('🔵 ナビ中のためタップを無視');
          return;
        }

        // ピンがある場合のみクリア
        if (routeMarker.current || destination) {
          console.log('🔵 タップ検出 - ピンクリア');

          // 目的地マーカーをクリア
          if (routeMarker.current) {
            routeMarker.current.remove();
            routeMarker.current = null;
          }

          // ルートをクリア
          if (map.current.getSource('route')) {
            map.current.getSource('route').setData({
              type: 'FeatureCollection',
              features: []
            });
          }

          // ストアの情報をクリア
          setDestination(null);
          setCurrentRoute(null);
          stopNavigation();
        }
      };

      // マウス/タッチ開始イベント
      const handlePointerDown = (e) => {
        // マルチタッチの場合はスキップ（ピンチ操作）
        if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) {
          touchCount = e.originalEvent.touches.length;
          // 長押しタイマーをクリア
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
          return;
        }

        touchCount = 1;
        touchStartTime = Date.now();
        touchStartPosition = e.lngLat;
        isLongPress = false;

        // 長押しタイマー開始
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          handleLongPress(touchStartPosition);
        }, LONG_PRESS_DURATION);
      };

      // ドラッグ検出（長押しタイマーをキャンセル）
      const handlePointerMove = (e) => {
        // マルチタッチ中は長押しタイマーをクリア
        if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
          touchCount = e.originalEvent.touches.length;
          return;
        }

        if (touchStartPosition && longPressTimer) {
          const dx = Math.abs(e.lngLat.lng - touchStartPosition.lng);
          const dy = Math.abs(e.lngLat.lat - touchStartPosition.lat);

          // 一定以上動いたらドラッグとみなす（閾値を大きく設定してズーム操作を考慮）
          if (dx > 0.001 || dy > 0.001) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }
      };

      // マウス/タッチ終了イベント
      const handlePointerUp = (e) => {
        // マルチタッチ中はスキップ
        if (touchCount > 1) {
          touchCount = 0;
          return;
        }

        const currentTime = Date.now();
        const pressDuration = touchStartTime ? currentTime - touchStartTime : 0;

        // 長押しタイマーをクリア
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }

        // 長押しでない場合の処理
        if (!isLongPress && pressDuration < LONG_PRESS_DURATION && pressDuration > 0) {
          // 位置が大きく動いていない場合（ドラッグではない）
          if (touchStartPosition && e.lngLat) {
            const dx = Math.abs(e.lngLat.lng - touchStartPosition.lng);
            const dy = Math.abs(e.lngLat.lat - touchStartPosition.lat);

            if (dx < 0.001 && dy < 0.001) {
              // ダブルタップチェック
              if (currentTime - lastTapTime < DOUBLE_TAP_DELAY && lastTapTime > 0) {
                // ダブルタップ検出
                console.log('🔵 ダブルタップ検出 - ズーム');
                if (doubleTapTimer) {
                  clearTimeout(doubleTapTimer);
                  doubleTapTimer = null;
                }
                lastTapTime = 0;
                tapCount = 0;
              } else {
                // シングルタップの可能性
                lastTapTime = currentTime;
                tapCount = 1;

                // ダブルタップ待機
                if (doubleTapTimer) {
                  clearTimeout(doubleTapTimer);
                }
                doubleTapTimer = setTimeout(() => {
                  if (tapCount === 1) {
                    // シングルタップ確定
                    handleSingleTap();
                  }
                  tapCount = 0;
                  doubleTapTimer = null;
                }, DOUBLE_TAP_DELAY);
              }
            }
          }
        }

        // リセット
        touchStartTime = null;
        touchStartPosition = null;
        isLongPress = false;
        touchCount = 0;
      };

      // マウスイベント
      map.current.on('mousedown', handlePointerDown);
      map.current.on('mousemove', handlePointerMove);
      map.current.on('mouseup', handlePointerUp);

      // タッチイベント
      map.current.on('touchstart', handlePointerDown);
      map.current.on('touchmove', handlePointerMove);
      map.current.on('touchend', handlePointerUp);

      // ダブルクリック/タップでズーム（mapboxのデフォルト動作を活用）
      map.current.doubleClickZoom.enable();
    } catch (error) {
      console.error('マップ初期化エラー:', error);
      setMapError(error.message || 'マップの初期化に失敗しました');
    }
  }, []);

  // デバイス方位センサー（コンパス）の初期化
  useEffect(() => {
    const requestOrientationPermission = async () => {
      // iOS 13+ではDeviceOrientationEventのパーミッションが必要
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            startCompassTracking();
          } else {
            console.warn('方位センサーの権限が拒否されました');
          }
        } catch (error) {
          console.error('方位センサー権限エラー:', error);
        }
      } else {
        // Android や iOS 12以下では自動的に開始
        startCompassTracking();
      }
    };

    const startCompassTracking = () => {
      const handleOrientation = (event) => {
        // event.alphaは0-360度、北が0度
        // iOSではwebkitCompassHeadingを使用（利用可能な場合）
        let heading = null;

        if (event.webkitCompassHeading !== undefined) {
          // iOS Safari: webkitCompassHeading (0 = 北)
          heading = event.webkitCompassHeading;
        } else if (event.alpha !== null) {
          // Android Chrome: alpha (0 = 北、時計回り）
          // ただし、alphaは磁北ではなくデバイスの向きなので調整が必要
          heading = 360 - event.alpha;
        }

        if (heading !== null) {
          setCompassHeading(heading);
        }
      };

      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);

      return () => {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
        window.removeEventListener('deviceorientation', handleOrientation, true);
      };
    };

    requestOrientationPermission();
  }, []);

  // 現在位置の変化を監視して速度を計算
  useEffect(() => {
    if (!currentLocation) return;

    if (lastPosition.current) {
      const distance = calculateDistance(lastPosition.current, currentLocation);
      const timeDiff = (Date.now() - lastPosition.current.timestamp) / 1000; // 秒

      if (timeDiff > 0) {
        // 速度を計算（m/s）
        const speed = distance / timeDiff;
        currentSpeed.current = speed;
        console.log('📍 現在速度:', (speed * 3.6).toFixed(1), 'km/h');
      }
    }

    lastPosition.current = {
      ...currentLocation,
      timestamp: Date.now()
    };
  }, [currentLocation]);

  // 現在位置マーカーを表示・更新
  useEffect(() => {
    if (!map.current || !currentLocation) return;

    if (currentLocationMarker.current) {
      // 既存のマーカーを更新
      currentLocationMarker.current.setLngLat([currentLocation.lng, currentLocation.lat]);

      // アイコンが変更された場合、マーカーを再作成
      const el = currentLocationMarker.current.getElement();
      if (currentLocationIcon) {
        el.style.backgroundImage = `url(${currentLocationIcon})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundColor = 'transparent';
      } else {
        el.style.backgroundImage = '';
        el.style.backgroundColor = '#4285F4';
      }
    } else {
      // 新しいマーカーを作成
      const el = document.createElement('div');
      el.className = 'current-location-marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.borderRadius = '50%';
      el.style.border = '4px solid white';
      el.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';

      // カスタムアイコンが設定されている場合
      if (currentLocationIcon) {
        el.style.backgroundImage = `url(${currentLocationIcon})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      } else {
        // デフォルトは青い円
        el.style.backgroundColor = '#4285F4';
      }

      currentLocationMarker.current = new mapboxgl.Marker(el)
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map.current);
    }
  }, [currentLocation, currentLocationIcon]);

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

      // ストアから音量を取得
      const storeState = useDeliveryStore.getState();
      const volume = storeState.voiceVolume;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = volume;

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleStartNavigation = () => {
    if (currentRoute && destination) {
      startNavigation();
      lastSpokenStep.current = -1;
      setIsOverviewMode(false);
      userInteracted.current = false;
      setShowRecenterButton(false);

      // 最初の案内を音声で
      const firstStep = currentRoute.legs[0].steps[0];
      speak(`ナビゲーションを開始します。${firstStep.maneuver.instruction}`);

      // カメラを現在位置中心に、進行方向を上に、現在位置を画面下から1/5に
      if (map.current && currentLocation) {
        const nextPoint = {
          lat: firstStep.maneuver.location[1],
          lng: firstStep.maneuver.location[0]
        };
        const bearing = calculateBearing(currentLocation, nextPoint);

        // 画面の高さを取得してpaddingを計算（現在位置が下から1/5の位置）
        const mapHeight = map.current.getContainer().offsetHeight;
        const topPadding = mapHeight * 0.6; // 上部60%をパディング
        const bottomPadding = 0; // 下部パディングなし

        // 最大ズーム-5（明示的に17に設定）
        const targetZoom = 17;

        console.log('ナビ開始 - ズーム:', targetZoom, 'maxZoom:', map.current.getMaxZoom(), 'padding:', { top: topPadding, bottom: bottomPadding });

        map.current.flyTo({
          center: [currentLocation.lng, currentLocation.lat],
          zoom: targetZoom,
          pitch: mapPitch,
          bearing: bearing,
          padding: { top: topPadding, bottom: bottomPadding, left: 0, right: 0 },
          duration: 2000
        });
      }
    }
  };

  const handleRecenter = () => {
    if (!currentRoute || !currentLocation) return;

    const steps = currentRoute.legs[0].steps;
    const currentStep = steps[currentStepIndex];
    const nextPoint = {
      lat: currentStep.maneuver.location[1],
      lng: currentStep.maneuver.location[0]
    };
    const bearing = calculateBearing(currentLocation, nextPoint);
    const mapHeight = map.current.getContainer().offsetHeight;
    const topPadding = mapHeight * 0.6;

    map.current.flyTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 17,
      pitch: mapPitch,
      bearing: bearing,
      padding: { top: topPadding, bottom: 0, left: 0, right: 0 },
      duration: 1000
    });

    userInteracted.current = false;
    setShowRecenterButton(false);
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
      const topPadding = mapHeight * 0.6; // 上部60%をパディング
      const bottomPadding = 0;

      // ズーム17に設定
      const targetZoom = 17;

      map.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: targetZoom,
        pitch: mapPitch,
        bearing: bearing,
        padding: { top: topPadding, bottom: bottomPadding, left: 0, right: 0 },
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

  const returnToUberApp = () => {
    console.log('🚗 Uberドライバーアプリに戻ります...');

    // Uberドライバーアプリのスキーム
    const uberSchemes = [
      'uber://',           // Uber一般
      'uberdriver://',     // Uberドライバー
      'ubereats://',       // Uber Eats配達員
    ];

    // 各スキームを試す
    let schemeIndex = 0;
    const tryScheme = () => {
      if (schemeIndex < uberSchemes.length) {
        const scheme = uberSchemes[schemeIndex];
        console.log('試行中:', scheme);

        // URLスキームで起動を試みる
        window.location.href = scheme;

        schemeIndex++;
        // 次のスキームを試す（500ms後）
        setTimeout(tryScheme, 500);
      } else {
        // すべて失敗した場合は、ブラウザバックを試みる
        console.log('Uberアプリが見つかりませんでした');

        // 履歴が存在する場合は戻る
        if (window.history.length > 1) {
          window.history.back();
        } else {
          // PWAの場合は通知を表示
          alert('配達完了！\nUberドライバーアプリにお戻りください。');
        }
      }
    };

    // スキームの試行を開始
    tryScheme();
  };

  const handleStopNavigation = () => {
    // 音声停止
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // ナビ終了前にルート全体表示に戻す
    if (map.current && currentRoute) {
      const coordinates = currentRoute.geometry.coordinates;
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 250, left: 50, right: 50 },
        pitch: 0,
        bearing: 0,
        duration: 1000
      });
    }

    stopNavigation();
    lastSpokenStep.current = -1;
    userInteracted.current = false;
    setShowRecenterButton(false);
  };

  const handleClearRoute = () => {
    // 音声停止
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    clearRoute();
    lastSpokenStep.current = -1;
    userInteracted.current = false;
    setShowRecenterButton(false);

    // ルートマーカーを削除
    if (map.current && routeMarker.current) {
      routeMarker.current.remove();
      routeMarker.current = null;
    }

    // ルートレイヤーを削除
    if (map.current) {
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }
    }
  };

  // ナビゲーション中の位置追跡
  useEffect(() => {
    if (!isNavigating || !currentRoute || !currentLocation || !destination) return;

    // 目的地との距離を計算
    const distanceToDestination = calculateDistance(currentLocation, destination);
    console.log('🎯 目的地までの距離:', distanceToDestination.toFixed(1), 'm');

    // 目的地まで15m以内なら到着と判定
    if (distanceToDestination < 15) {
      console.log('🎉 目的地に到着！');
      speak('目的地に到着しました。お疲れ様でした。');

      setTimeout(() => {
        // 音声停止
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        // ピンとルートをクリア
        if (routeMarker.current) {
          routeMarker.current.remove();
          routeMarker.current = null;
        }

        // ルートをクリア
        if (map.current && map.current.getSource('route')) {
          map.current.getSource('route').setData({
            type: 'FeatureCollection',
            features: []
          });
        }

        // 現在地を中心に表示
        if (map.current && currentLocation) {
          map.current.easeTo({
            center: [currentLocation.lng, currentLocation.lat],
            zoom: 15,
            pitch: 0,
            bearing: 0,
            duration: 1500
          });
        }

        // ストアの情報をクリア
        setDestination(null);
        setCurrentRoute(null);
        stopNavigation();
        lastSpokenStep.current = -1;
        userInteracted.current = false;
        setShowRecenterButton(false);

        // Uberドライバーアプリに戻る
        setTimeout(() => {
          returnToUberApp();
        }, 2000);
      }, 2000);
      return;
    }

    const steps = currentRoute.legs[0].steps;
    if (currentStepIndex >= steps.length) {
      // 全ステップ完了（フォールバック）
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
    // ユーザーが手動でスワイプした場合は追従しない
    if (map.current && !isOverviewMode && !userInteracted.current) {
      let bearing;

      // 速度が3 m/s（約10 km/h）以下の場合はコンパスの向き、それ以上は進行方向
      if (currentSpeed.current < 3 && compassHeading !== null) {
        // 低速時：コンパスの向きを使用
        bearing = compassHeading;
        console.log('🧭 コンパス使用:', bearing.toFixed(0), '度');
      } else {
        // 高速時：進行方向を使用
        bearing = calculateBearing(currentLocation, nextPoint);
        console.log('🚗 進行方向使用:', bearing.toFixed(0), '度');
      }

      const mapHeight = map.current.getContainer().offsetHeight;
      const topPadding = mapHeight * 0.6; // 上部60%をパディング
      const bottomPadding = 0;

      map.current.easeTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 17,
        pitch: mapPitch,
        bearing: bearing,
        padding: { top: topPadding, bottom: bottomPadding, left: 0, right: 0 },
        duration: 1000,
        easing: (t) => t // リニア補間でスムーズに
      });
    }
  }, [currentLocation, isNavigating, currentStepIndex, isOverviewMode, stopNavigation, mapPitch, destination]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />

      {/* マップエラー表示 */}
      {mapError && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">マップを読み込めません</h3>
            <p className="text-gray-600 mb-4">{mapError}</p>
            <div className="text-sm text-gray-500 mb-4">
              <p>以下を確認してください：</p>
              <ul className="list-disc list-inside text-left mt-2">
                <li>ブラウザがWebGLをサポートしているか</li>
                <li>ハードウェアアクセラレーションが有効か</li>
                <li>別のブラウザで試してみる</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              再読み込み
            </button>
          </div>
        </div>
      )}

      {/* 目的地名称表示（目的地が設定されている場合） */}
      {destination && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-full px-6 py-3 z-10 max-w-xs">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="text-sm font-bold text-gray-900 truncate">
              {destination.name || `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`}
            </span>
          </div>
        </div>
      )}

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

      {/* ヘルプボタン（左上、設定の下） */}
      <button
        onClick={() => setShowHelp(true)}
        className="absolute top-20 left-4 p-3 rounded-full bg-white shadow-lg hover:bg-gray-100 transition-colors z-10"
      >
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* ヘルプモーダル */}
      {showHelp && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-800">地図の操作方法</h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">📍</span>
                <div>
                  <p className="font-semibold">長押し（0.5秒）</p>
                  <p className="text-sm text-gray-600">目的地にピンを設置してナビ開始</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">🗑️</span>
                <div>
                  <p className="font-semibold">タップ</p>
                  <p className="text-sm text-gray-600">ピンと経路をクリア</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">🔍</span>
                <div>
                  <p className="font-semibold">ダブルタップ</p>
                  <p className="text-sm text-gray-600">拡大・縮小</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-1">✋</span>
                <div>
                  <p className="font-semibold">ドラッグ</p>
                  <p className="text-sm text-gray-600">地図を移動</p>
                </div>
              </li>
            </ul>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 現在位置に戻るボタン（ナビ中、スワイプ後のみ表示） */}
      {isNavigating && showRecenterButton && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-24 left-4 p-5 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600 transition-all z-10 animate-bounce"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}

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
});

export default Map;
