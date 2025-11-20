# PWAでのURL処理ガイド

## ⚠️ PWAの制限事項

PWA（Progressive Web App）では、**直接的なURLインターセプトには制限**があります。これはブラウザのセキュリティポリシーによるものです。

### 現在の対応状況

| 方法 | Android | iOS Safari | PC Chrome | 動作条件 |
|------|---------|-----------|-----------|----------|
| **直接インターセプト** | ❌ | ❌ | ❌ | ネイティブアプリのみ可能 |
| **共有メニュー経由** | ✅ | ⚠️ | ⚠️ | Share Target API（要PWAインストール） |
| **URLパラメータ** | ✅ | ✅ | ✅ | 手動でURL作成が必要 |
| **カスタムプロトコル** | ⚠️ | ❌ | ⚠️ | 実験的機能 |

## PWAでUberドライバーアプリのURLを開く方法

### 方法1: 共有メニュー経由（Android推奨）🔄

1. **UberドライバーアプリでGoogleマップのURLをコピー**
2. **共有メニューから「配達マップ」を選択**
   - 事前にPWAをインストールしておく必要があります
   - Androidでは共有メニューにPWAが表示されます

### 方法2: URLコピー＆ペースト方式 📋

最も確実な方法です：

1. **UberドライバーアプリでURLをコピー**
   ```
   例: https://www.google.com/maps/dir/?api=1&destination=34.94944,135.75644&avoid=highways
   ```

2. **配達マップPWAを開く**
   - https://matasuke-smk.github.io/delivery-map/

3. **以下のいずれかの方法でURLを処理**：

   **A. ブックマークレット（推奨）**
   ```javascript
   javascript:(function(){
     const url = prompt('GoogleマップのURLを貼り付けてください:');
     if(url) window.location.href = 'https://matasuke-smk.github.io/delivery-map/?url=' + encodeURIComponent(url);
   })();
   ```

   **B. 手動でURLパラメータを追加**
   ```
   https://matasuke-smk.github.io/delivery-map/?url=[エンコードしたURL]
   ```

### 方法3: ショートカット作成（iOS）📱

iOSの「ショートカット」アプリを使用：

1. **新規ショートカットを作成**
2. **アクション追加**：
   - 「クリップボードを取得」
   - 「URLを開く」（配達マップのURLに`?url=`を付けて）
3. **ホーム画面に追加**

### 方法4: Androidの「インテント」アプリ使用 🤖

サードパーティアプリを使ってURLを自動的に配達マップで開く：

1. **「Better Open With」などのアプリをインストール**
2. **GoogleマップのURLを配達マップにリダイレクトする設定**

## 🎯 実用的な運用方法

### PWAユーザー向けの最適な手順

1. **配達マップPWAをインストール**
   - Chrome/Edgeで https://matasuke-smk.github.io/delivery-map/ を開く
   - 「ホーム画面に追加」または「アプリをインストール」

2. **ブックマークレットを作成**（PC/Android Chrome）
   - 上記のJavaScriptコードをブックマークとして保存
   - 名前: 「配達マップで開く」

3. **使用時の流れ**：
   ```
   Uberアプリ → URLコピー → ブックマークレット実行 → 自動的に配達マップで開く
   ```

## 💡 今後の改善予定

1. **Chrome拡張機能の開発**
   - GoogleマップのURLを自動検出
   - ワンクリックで配達マップに転送

2. **専用Androidアプリ**
   - Intent Filterで完全な自動インターセプト
   - PWAより確実な動作

3. **URL Handler API**
   - 将来的にブラウザがサポートした場合、自動インターセプトが可能に

## トラブルシューティング

### Q: PWAで自動的にURLをインターセプトできないのはなぜ？
A: ブラウザのセキュリティポリシーにより、PWAは他のドメインのURLを直接インターセプトできません。これはユーザーのプライバシーとセキュリティを保護するための仕様です。

### Q: ネイティブアプリなら可能？
A: はい、CapacitorでビルドしたAndroid/iOSアプリなら、Intent Filter（Android）やUniversal Links（iOS）で自動インターセプトが可能です。

### Q: 最も簡単な方法は？
A: 現時点では「URLコピー → ブックマークレット実行」が最も簡単で確実です。

---

**注意**: PWAの機能は継続的に進化しています。将来的にはより良いソリューションが利用可能になる可能性があります。