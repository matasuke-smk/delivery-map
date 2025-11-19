# MapboxトークンをプロジェクトにStep設定してください

## 1. Mapboxトークンの取得

1. https://account.mapbox.com/ にログイン
2. 「Tokens」ページに移動
3. 「Default public token」をコピー（pk.eyJ1...で始まる文字列）
   または「Create a token」で新規作成

## 2. プロジェクトへの設定

### .envファイルを作成して以下を追加:
```
VITE_MAPBOX_TOKEN=pk.eyJ1IjoibWF0YXN1a2UiLCJhIjoiY21pNWtuOTJrMmh1eDJpb2xvcnRpd2Z3MSJ9.yLRk4Nj5BMSvbQlcZ-sP6Q
```

## 3. 設定確認

.envファイルが正しく作成されているか確認:
- ファイル名: `.env`（.env.txtなどではない）
- 場所: プロジェクトルート（package.jsonと同じ階層）
- 形式: VITE_MAPBOX_TOKEN=トークン値（クォート不要）

## 4. .gitignoreに追加（重要）

.gitignoreファイルに以下を追加してトークンを公開しないようにする:
```
.env
.env.local
```