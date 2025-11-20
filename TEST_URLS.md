# テスト用URL一覧

## UberドライバーアプリからのURL（実際のパターン）

### 基本的な目的地指定
```
https://www.google.com/maps/dir/?api=1&destination=34.949439999999996,135.75644000000003&avoid=highways
```
- 京都付近の座標
- 高速道路を避ける設定付き

## テスト用URL（GitHub Pages）

### 1. Uberドライバー形式のURL（高速道路回避あり）
```
https://matasuke-smk.github.io/delivery-map/?url=https%3A%2F%2Fwww.google.com%2Fmaps%2Fdir%2F%3Fapi%3D1%26destination%3D34.949439999999996%2C135.75644000000003%26avoid%3Dhighways
```

### 2. Uberドライバー形式のURL（高速道路回避なし）
```
https://matasuke-smk.github.io/delivery-map/?url=https%3A%2F%2Fwww.google.com%2Fmaps%2Fdir%2F%3Fapi%3D1%26destination%3D35.6812%2C139.7671
```
- 東京駅付近の座標

### 3. 通常のGoogleマップURL
```
https://matasuke-smk.github.io/delivery-map/?url=https%3A%2F%2Fmaps.google.com%2Fmaps%3Fq%3D35.6762%2C139.6503
```
- 東京タワー付近の座標

### 4. 場所名付きURL
```
https://matasuke-smk.github.io/delivery-map/?url=https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2F%E4%BA%AC%E9%83%BD%E9%A7%85%2F%4034.985458%2C135.758755%2C15z
```
- 京都駅

## 機能確認ポイント

1. **目的地の設定**
   - 座標が正しく解析されているか
   - 地図が目的地にズームされるか
   - ピンが設置されるか

2. **高速道路回避設定**
   - `avoid=highways`パラメータがある場合、設定画面で「有料道路を使用」がOFFになっているか
   - ルート検索時に高速道路が除外されているか

3. **ルート検索**
   - 現在地から目的地までのルートが表示されるか
   - ナビゲーションを開始できるか

## Android/iOSアプリでのテスト

Capacitorアプリをビルドして、実際のUberドライバーアプリから地図を開く際に、配達マップアプリが選択肢として表示されるか確認してください。

### Androidの場合
1. AndroidManifest.xmlで定義したIntent Filterが機能しているか
2. 「このアプリで開く」の選択肢に表示されるか

### iOSの場合
1. Info.plistで定義したURLスキームが機能しているか
2. 共有シートから開けるか