# 🏍️ 配達マップアプリ

Uber Eats配達員向けのマップアプリです。バイク配達に特化したルート検索、店舗位置の自動記録、訪問回数の追跡機能を提供します。

## 機能

- 📍 **自動店舗記録**: 3分以上停止すると自動的に店舗として記録
- 🗺️ **地図表示**: Mapboxを使用した高品質な地図
- 📊 **訪問統計**: よく行く店舗TOP20を表示
- 🔄 **リアルタイム追跡**: バックグラウンドでも位置情報を追跡
- 💾 **データ永続化**: 端末内にデータを安全に保存

## セットアップ

### 1. Mapboxトークンの取得

1. [Mapbox](https://www.mapbox.com/)にアクセス
2. アカウント作成（無料）
3. Access Tokenを取得
4. `.env`ファイルを編集:

```bash
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

### 2. Web開発サーバーで実行

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開く

### 3. ビルド

```bash
npm run build
```

### 4. iOS/Androidアプリとして実行

#### iOS（Mac必須）

```bash
npx cap open ios
```

Xcodeが開くので、実機またはシミュレータで実行

#### Android（Android Studio必須）

```bash
npx cap open android
```

Android Studioが開くので、エミュレータまたは実機で実行

## 使い方

### 初回起動

1. アプリを開く
2. 位置情報権限を**必ず許可**
3. 自動的に追跡が開始されます

### 追跡の開始/停止

- ヘッダー右上のボタンで切り替え
- 緑色 = 追跡中
- グレー = 停止中

### 店舗の記録

- 3分以上同じ場所に停止すると自動記録
- 訪問回数が増えるとマーカーが大きくなる
- マーカークリックで詳細表示

### タブ機能

- **地図**: 店舗位置をマーカーで表示
- **店舗**: よく行く店舗TOP20
- **分析**: 追跡状態と機能説明

## 技術スタック

- **Vite** - ビルドツール
- **React** - UIフレームワーク
- **Tailwind CSS** - スタイリング
- **Mapbox GL JS** - 地図表示
- **Capacitor** - ネイティブアプリ化
  - Geolocation - 位置情報取得
  - Preferences - データ保存
- **Zustand** - 状態管理

## ディレクトリ構造

```
delivery-map/
├── src/
│   ├── components/    # Reactコンポーネント
│   │   ├── Map.jsx
│   │   ├── StoreList.jsx
│   │   └── RouteInfo.jsx
│   ├── services/      # サービス層
│   │   └── locationTracker.js
│   ├── stores/        # 状態管理
│   │   └── deliveryStore.js
│   ├── App.jsx        # メインアプリ
│   └── index.css      # スタイル
├── ios/               # iOSプロジェクト
├── android/           # Androidプロジェクト
└── dist/              # ビルド出力
```

## 重要な注意点

### 位置情報権限

- **iOS**: Info.plistで設定済み
- **Android**: AndroidManifest.xmlで設定済み
- 初回起動時に必ず「常に許可」を選択

### バッテリー消費

- 継続的な位置追跡はバッテリーを消費します
- 必要に応じて追跡を停止してください

### プライバシー

- 位置情報は端末内にのみ保存されます
- 外部サーバーには送信されません

## トラブルシューティング

### 地図が表示されない

- `.env`ファイルのMapboxトークンを確認
- `npm run build`を再実行

### 位置情報が取得できない

- 位置情報権限が許可されているか確認
- 実機で「常に許可」を選択しているか確認

### ビルドエラー

```bash
rm -rf node_modules
npm install
npm run build
```

### Capacitorエラー

```bash
npx cap sync
```

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# iOS開く
npx cap open ios

# Android開く
npx cap open android

# 同期
npx cap sync

# ビルド + 同期
npm run build && npx cap sync
```

## ライセンス

MIT

## 作成者

Takahiro
