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
        setCurrentLocation({
          lat: e.coords.latitude,
          lng: e.coords.longitude
        });
        console.log('GPS位置更新:', { lat: e.coords.latitude, lng: e.coords.longitude });
      });

      // マップロード後に現在位置を取得と日本語設定
      map.current.on('load', () => {
        // すべてのテキストレイヤーを日本語に設定
        const layers = map.current.getStyle().layers;
        layers.forEach((layer) => {
          if (layer.layout && layer.layout['text-field']) {
            // 日本語のテキストフィールドに変更
            map.current.setLayoutProperty(
              layer.id,
              'text-field',
              ['coalesce', ['get', 'name_ja'], ['get', 'name_en'], ['get', 'name']]
            );
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

        console.log('地図クリック:', { lat, lng });
        console.log('現在位置:', currentLocation);

        // 目的地マーカーを更新
        if (routeMarker.current) {
          routeMarker.current.remove();
        }

        routeMarker.current = new mapboxgl.Marker({ color: '#3B82F6' })
          .setLngLat([lng, lat])
          .addTo(map.current);

        setDestination({ lat, lng });

        // 現在位置がある場合はルート検索
        if (currentLocation && currentLocation.lat && currentLocation.lng) {
          console.log('ルート検索開始');
          await searchRoute(currentLocation, { lat, lng });
        } else {
          console.warn('現在位置が取得できていません。位置情報を許可してください。');
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
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=${mapboxgl.accessToken}&language=ja&alternatives=true&steps=true&overview=full`;

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

  return <div ref={mapContainer} className="w-full h-full" />;
}

export default Map;
