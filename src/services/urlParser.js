/**
 * GoogleマップのURLを解析して、座標や場所情報を抽出する
 */

export const parseGoogleMapsUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const result = {
      lat: null,
      lng: null,
      placeName: null,
      address: null,
      zoom: null
    };

    // URLパターンの解析
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // パターン1: /maps/place/{場所名}/@{lat},{lng},{zoom}z
    const placeMatch = pathname.match(/\/maps\/place\/([^\/]+)\/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z/);
    if (placeMatch) {
      result.placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
      result.lat = parseFloat(placeMatch[2]);
      result.lng = parseFloat(placeMatch[3]);
      result.zoom = parseInt(placeMatch[4]);
      return result;
    }

    // パターン2: /maps/@{lat},{lng},{zoom}z
    const coordMatch = pathname.match(/\/maps\/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z/);
    if (coordMatch) {
      result.lat = parseFloat(coordMatch[1]);
      result.lng = parseFloat(coordMatch[2]);
      result.zoom = parseInt(coordMatch[3]);
      return result;
    }

    // パターン3: /maps/dir/{開始地点}/{目的地}
    const dirMatch = pathname.match(/\/maps\/dir\/([^\/]+)\/([^\/]+)/);
    if (dirMatch) {
      const destination = decodeURIComponent(dirMatch[2]).replace(/\+/g, ' ');

      // 座標形式のチェック
      const coordPattern = /^(-?\d+\.\d+),(-?\d+\.\d+)$/;
      const destCoordMatch = destination.match(coordPattern);

      if (destCoordMatch) {
        result.lat = parseFloat(destCoordMatch[1]);
        result.lng = parseFloat(destCoordMatch[2]);
      } else {
        result.address = destination;
      }
      return result;
    }

    // パターン4: /maps/search/{検索クエリ}
    const searchMatch = pathname.match(/\/maps\/search\/([^\/]+)/);
    if (searchMatch) {
      result.address = decodeURIComponent(searchMatch[1]).replace(/\+/g, ' ');
      return result;
    }

    // パターン5: クエリパラメータから取得
    if (searchParams.has('q')) {
      const query = searchParams.get('q');

      // 座標形式のチェック
      const coordPattern = /^(-?\d+\.\d+),(-?\d+\.\d+)$/;
      const coordMatch = query.match(coordPattern);

      if (coordMatch) {
        result.lat = parseFloat(coordMatch[1]);
        result.lng = parseFloat(coordMatch[2]);
      } else {
        result.address = query;
      }
      return result;
    }

    // パターン6: ll パラメータ（座標）
    if (searchParams.has('ll')) {
      const ll = searchParams.get('ll');
      const [lat, lng] = ll.split(',');
      result.lat = parseFloat(lat);
      result.lng = parseFloat(lng);
      return result;
    }

    // パターン7: destination パラメータ（Uberドライバーアプリが使用）
    if (searchParams.has('destination')) {
      const destination = searchParams.get('destination');

      // 座標形式のチェック
      const coordPattern = /^(-?\d+\.\d+),(-?\d+\.\d+)$/;
      const coordMatch = destination.match(coordPattern);

      if (coordMatch) {
        result.lat = parseFloat(coordMatch[1]);
        result.lng = parseFloat(coordMatch[2]);
      } else {
        result.address = destination;
      }

      // avoidパラメータの処理（高速道路を避ける設定）
      if (searchParams.has('avoid')) {
        const avoid = searchParams.get('avoid');
        if (avoid === 'highways') {
          result.avoidHighways = true;
        }
      }

      return result;
    }

    // パターン8: saddr（開始地点）とdaddr（目的地）パラメータ
    if (searchParams.has('daddr')) {
      const daddr = searchParams.get('daddr');

      // 座標形式のチェック
      const coordPattern = /^(-?\d+\.\d+),(-?\d+\.\d+)$/;
      const coordMatch = daddr.match(coordPattern);

      if (coordMatch) {
        result.lat = parseFloat(coordMatch[1]);
        result.lng = parseFloat(coordMatch[2]);
      } else {
        result.address = daddr;
      }
      return result;
    }

    // パターン9: geoスキーム (geo:lat,lng)
    if (url.startsWith('geo:')) {
      const geoMatch = url.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (geoMatch) {
        result.lat = parseFloat(geoMatch[1]);
        result.lng = parseFloat(geoMatch[2]);
        return result;
      }
    }

    // パターン10: maps.app.goo.gl短縮URL（リダイレクト先を解析）
    if (urlObj.hostname === 'maps.app.goo.gl') {
      // 短縮URLの場合、実際にはリダイレクト先のURLを取得する必要があるため
      // ここではURLをそのまま返す
      result.shortUrl = url;
      return result;
    }

    return result;
  } catch (error) {
    console.error('URL解析エラー:', error);
    return null;
  }
};

/**
 * 住所や場所名から座標を取得（Mapbox Geocoding API使用）
 */
export const geocodeAddress = async (address, mapboxToken) => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&language=ja&country=JP`
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return {
        lat,
        lng,
        placeName: data.features[0].place_name,
        address: data.features[0].place_name
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

/**
 * Overpass APIを使って建物名を取得
 */
export const getBuildingNameFromOSM = async (lat, lng) => {
  try {
    // 半径50m以内の建物・POIを検索（範囲を拡大）
    const radius = 50;
    const query = `
      [out:json][timeout:10];
      (
        node["name"](around:${radius},${lat},${lng});
        way["name"](around:${radius},${lat},${lng});
        relation["name"](around:${radius},${lat},${lng});
      );
      out center 20;
    `;

    console.log('🔍 OSM検索開始:', { lat, lng, radius });

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('🏢 Overpass API結果:', data);

    if (data.elements && data.elements.length > 0) {
      // 最も近い建物を探す
      let closestElement = null;
      let minDistance = Infinity;

      for (const element of data.elements) {
        if (element.tags && element.tags.name) {
          // 距離を計算（nodeの場合は直接、wayの場合は中心点を計算）
          let elementLat, elementLng;

          if (element.type === 'node') {
            elementLat = element.lat;
            elementLng = element.lon;
          } else if (element.type === 'way' || element.type === 'relation') {
            // centerが利用可能な場合
            if (element.center) {
              elementLat = element.center.lat;
              elementLng = element.center.lon;
            } else if (element.lat && element.lon) {
              elementLat = element.lat;
              elementLng = element.lon;
            } else {
              // 中心座標がない場合はスキップ
              continue;
            }
          } else {
            continue;
          }

          // ハバーサイン公式で距離を計算（メートル単位）
          const R = 6371000; // 地球の半径（メートル）
          const φ1 = lat * Math.PI / 180;
          const φ2 = elementLat * Math.PI / 180;
          const Δφ = (elementLat - lat) * Math.PI / 180;
          const Δλ = (elementLng - lng) * Math.PI / 180;

          const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          console.log(`📍 ${element.tags.name}: ${distance.toFixed(1)}m`);

          if (distance < minDistance) {
            minDistance = distance;
            closestElement = element;
          }
        }
      }

      if (closestElement && closestElement.tags.name) {
        const result = {
          name: closestElement.tags.name,
          fullName: closestElement.tags.name,
          type: closestElement.tags.building ? 'building' :
                closestElement.tags.shop ? 'shop' :
                closestElement.tags.amenity ? 'amenity' : 'poi',
          source: 'osm',
          distance: minDistance
        };
        console.log('✅ 最も近い建物:', result);
        return result;
      }
    }

    console.log('⚠️ OSMで建物が見つかりませんでした');
    return null;
  } catch (error) {
    console.error('🔴 Overpass API error:', error);
    return null;
  }
};

/**
 * 座標から場所名を取得（リバースジオコーディング）
 * 優先順位: OSM建物名 > Mapbox POI > Mapbox住所
 */
export const reverseGeocode = async (lat, lng, mapboxToken) => {
  // まずOSMから建物名を取得
  try {
    const osmResult = await getBuildingNameFromOSM(lat, lng);
    if (osmResult) {
      console.log('✅ OSMから建物名取得:', osmResult.name);
      return osmResult;
    }
  } catch (error) {
    console.warn('⚠️ OSM検索失敗、Mapboxにフォールバック');
  }

  // OSMで見つからない場合はMapboxにフォールバック
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&language=ja&types=poi,address,place`
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      // 最も関連性の高い結果を取得
      const feature = data.features[0];

      // POI（店舗・施設）がある場合は優先的に使用
      const poiFeature = data.features.find(f => f.place_type.includes('poi'));

      if (poiFeature) {
        return {
          name: poiFeature.text,
          fullName: poiFeature.place_name,
          type: 'poi',
          source: 'mapbox'
        };
      }

      // POIがない場合は住所を使用
      return {
        name: feature.text,
        fullName: feature.place_name,
        type: feature.place_type[0],
        source: 'mapbox'
      };
    }

    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

/**
 * 外部URLを処理して目的地を設定
 */
export const handleExternalUrl = async (url, mapboxToken) => {
  const parsed = parseGoogleMapsUrl(url);

  if (!parsed) {
    return null;
  }

  // 座標が既にある場合はそのまま返す
  if (parsed.lat && parsed.lng) {
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      placeName: parsed.placeName || parsed.address || `${parsed.lat}, ${parsed.lng}`,
      source: 'google-maps-url'
    };
  }

  // 住所がある場合はジオコーディング
  if (parsed.address) {
    const geocoded = await geocodeAddress(parsed.address, mapboxToken);
    if (geocoded) {
      return {
        ...geocoded,
        source: 'google-maps-url-geocoded'
      };
    }
  }

  // 短縮URLの場合（実装は別途必要）
  if (parsed.shortUrl) {
    console.log('短縮URL検出:', parsed.shortUrl);
    // 注: 短縮URLの展開には別途実装が必要
    return null;
  }

  return null;
};