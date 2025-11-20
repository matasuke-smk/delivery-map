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