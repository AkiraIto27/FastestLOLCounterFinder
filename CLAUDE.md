# FastestLOLCounterFinder

## プロジェクト概要
League of Legends カウンター情報を極限まで高速表示するStatic-Firstアーキテクチャの実装

### 設計思想
- **静的ファースト**: 全処理をビルド時に完了、クライアントサイド処理は最小限
- **ゼロ・レンダリングブロック**: 初期表示を妨げる要素の完全排除
- **最小限のデータ転送**: 初期表示データ量の極限削減

## 技術スタック
- **Runtime**: Node.js (ビルド時のみ)
- **出力**: 純粋な静的HTML + Service Worker
- **スタイリング**: `<table>`タグのみ（CSS不使用）
- **API**: Riot Games API v4/v5

## ビルドコマンド
```bash
# 開発用ビルド（テスト用）
npm run build:dev

# 本番ビルド（全データ取得）
npm run build:prod

# ローカル開発サーバー
npm run serve

# APIキー検証
npm run verify-api-key
```

## 環境変数
```bash
# .env ファイルに設定
RIOT_API_KEY=your_personal_api_key_here
TARGET_REGION=jp1
OUTPUT_DIR=./dist
```

## API制約とレート制限
- **個人用APIキー**: 1秒20リクエスト, 2分100リクエスト（リージョン毎）
- **429エラー対応**: Retry-Afterヘッダー準拠の待機実装必須
- **データ永続化**: APIレスポンスをdata.jsonにキャッシュ

## プロジェクト構造
```
├── src/
│   ├── build.js           # メインビルドスクリプト
│   ├── api-client.js      # Riot API クライアント
│   ├── html-generator.js  # 静的HTML生成器
│   └── image-downloader.js # 画像ローカル化
├── dist/                  # 生成物出力ディレクトリ
│   ├── index.html         # 新着順（デフォルト）
│   ├── a-z.html          # A-Z順
│   ├── z-a.html          # Z-A順
│   ├── category-*.html   # カテゴリ別
│   ├── images/           # ローカル化画像
│   └── sw.js             # Service Worker
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