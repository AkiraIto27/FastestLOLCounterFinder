# FastestLOLCounterFinder

## プロジェクト概要
League of Legends カウンター情報を極限まで高速表示するStatic-Firstアーキテクチャの実装

### 設計思想
- **静的ファースト**: 全処理をビルド時に完了、クライアントサイド処理は最小限
- **ゼロ・レンダリングブロック**: 初期表示を妨げる要素の完全排除
- **最小限のデータ転送**: 初期表示データ量の極限削減

## 技術スタック
- **Runtime**: Node.js >=18.0.0 (ビルド時のみ)
- **出力**: 純粋な静的HTML + Service Worker
- **スタイリング**: `<table>`タグのみ（CSS不使用）
- **API**: Riot Games API v4/v5
- **依存関係**:
  - node-fetch: ^3.3.2 (HTTP クライアント)
  - fs-extra: ^11.2.0 (ファイル操作拡張)
  - glob: ^10.3.10 (ファイルパス検索)
  - dotenv: ^16.3.1 (環境変数管理)
  - http-server: ^14.1.1 (開発用サーバー)

## ビルドコマンド
```bash
# 開発用ビルド（テスト用）- ルート直下配置
npm run build:dev

# 本番ビルド（全データ取得）- ルート直下配置
npm run build:prod

# 従来のdist/配置ビルド（互換性用）
npm run build:dist

# ローカル開発サーバー（ルート直下）
npm run serve

# dist/配置サーバー（互換性用）
npm run serve:dist

# APIキー検証
npm run verify-api-key

# ルート直下クリーンアップ（デフォルト）
npm run clean

# dist/配置クリーンアップ（互換性用）
npm run clean:dist

# 開発前クリーンアップ
npm run predev

# ビルド+サーバー起動（一括実行）
npm run dev
```

## 環境変数
```bash
# .env ファイルに設定
RIOT_API_KEY=your_personal_api_key_here
TARGET_REGION=jp1
ACCOUNT_REGION=asia
OUTPUT_DIR=.
CACHE_DIR=./data
DEBUG_MODE=false
```

## プロジェクト設定（package.json config）
```json
{
  "api": {
    "baseUrl": "https://jp1-api.riotgames.com",
    "accountBaseUrl": "https://asia.api.riotgames.com",
    "rateLimit": {
      "requestsPerSecond": 20,
      "requestsPer2Minutes": 100
    }
  },
  "output": {
    "htmlPages": [
      "index.html", "a-z.html", "z-a.html",
      "category-assassin.html", "category-fighter.html",
      "category-mage.html", "category-marksman.html", 
      "category-support.html", "category-tank.html"
    ]
  },
  "performance": {
    "targetFirstPaint": 100,
    "targetLCP": 500, 
    "targetCLS": 0.1,
    "maxInitialPageSize": 51200
  }
}
```

## API制約とレート制限
- **個人用APIキー**: 1秒20リクエスト, 2分100リクエスト（リージョン毎）
- **429エラー対応**: Retry-Afterヘッダー準拠の待機実装必須
- **データ永続化**: APIレスポンスをcache.jsonにキャッシュ
- **現在対応バージョン**: 15.12.1 (2025年6月21日時点)
- **対象リージョン**: jp1 (日本) / asia (アカウント情報)

## プロジェクト構造
```
├── src/
│   ├── build.js                 # メインビルドスクリプト
│   ├── api-client.js            # Riot API クライアント
│   ├── html-generator.js        # 静的HTML生成器
│   ├── image-downloader.js      # 画像ローカル化
│   ├── service-worker-updater.js # Service Worker更新処理
│   └── verify-api-key.js        # APIキー検証ツール
├── index.html            # 新着順（デフォルト）- ルート直下配置
├── a-z.html             # A-Z順
├── z-a.html             # Z-A順
├── category-*.html      # カテゴリ別
├── images/              # ローカル化画像
├── manifest.json        # PWA設定
├── sw.js                # Service Worker
├── dist/                # 互換性用ディレクトリ（通常は空）
├── data/
│   └── cache.json        # APIレスポンスキャッシュ
└── templates/
    └── page.html         # HTMLテンプレート
```

## コーディング規約
- **HTML**: 文書構造のみ、レイアウトは`<table>`タグ使用
- **JavaScript**: ビルドスクリプトのみ、クライアントサイドJS禁止（SW登録除く）
- **画像**: 全て`loading="lazy"`と`width`/`height`属性必須
- **レスポンス処理**: 空値省略仕様への対応（null/undefined/0/""は省略される）

## データフロー
1. **Account API**: Riot ID → PUUID変換
2. **Summoner API**: PUUID → サマナー情報
3. **League API**: PUUID → ランク情報  
4. **Match API**: PUUID → 試合履歴 → 勝敗統計

## 出力HTML仕様
- **DOCTYPE**: HTML5
- **CSS**: 一切使用禁止（外部/内部/インライン全て）
- **JavaScript**: Service Worker登録のみ（`</body>`直前、非同期実行）
- **画像**: 遅延ロード必須、レイアウトシフト防止
- **ナビゲーション**: 単純な`<a href>`リンクのみ

## Service Worker戦略
- **Cache First**: 一度キャッシュされたリソースを優先
- **バージョン管理**: ビルド毎にsw.jsコメント更新で強制更新
- **オフライン対応**: 全リソースのプリキャッシュ実装

## パフォーマンス目標
- **First Paint**: 100ms以下
- **LCP**: 500ms以下  
- **CLS**: 0.1以下
- **転送量**: 初期ページ50KB以下（画像除く）