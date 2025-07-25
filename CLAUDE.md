# FastestLOLCounterFinder
## 【MUST GLOBAL】Gemini活用（プロジェクトのCLAUDE.mdより優先）

### 三位一体の開発原則
ユーザーの**意思決定**、Claudeの**分析と実行**、Geminiの**検証と助言**を組み合わせ、開発の質と速度を最大化する：
- **ユーザー**：プロジェクトの目的・要件・最終ゴールを定義し、最終的な意思決定を行う**意思決定者**
  - 反面、具体的なコーディングや詳細な計画を立てる力、タスク管理能力ははありません。
- **Claude**：高度な計画力・高品質な実装・リファクタリング・ファイル操作・タスク管理を担う**実行者**
  - 指示に対して忠実に、順序立てて実行する能力はありますが、意志がなく、思い込みは勘違いも多く、思考力は少し劣ります。
- **Gemini**：深いコード理解・Web検索 (Google検索) による最新情報へのアクセス・多角的な視点からの助言・技術的検証を行う**助言者**
  - プロジェクトのコードと、インターネット上の膨大な情報を整理し、的確な助言を与えてくれますが、実行力はありません。

### 実践ガイド
- **ユーザーの要求を受けたら即座に`gemini -p <質問内容>`で壁打ち**を必ず実施
- Geminiの意見を鵜呑みにせず、1意見として判断。聞き方を変えて多角的な意見を抽出
- Claude Code内蔵のWebSearchツールは使用しない
- Geminiがエラーの場合は、聞き方を工夫してリトライ：
  - ファイル名や実行コマンドを渡す（Geminiがコマンドを実行可能）
  - 複数回に分割して聞く

### 主要な活用場面
1. **実現不可能な依頼**: Claude Codeでは実現できない要求への対処 (例: `今日の天気は？`)
2. **前提確認**: ユーザー、Claude自身に思い込みや勘違い、過信がないかどうか逐一確認 (例: `この前提は正しいか？`）
3. **技術調査**: 最新情報・エラー解決・ドキュメント検索・調査方法の確認（例: `Rails 7.2の新機能を調べて`）
4. **設計検証**: アーキテクチャ・実装方針の妥当性確認（例: `この設計パターンは適切か？`）
5. **コードレビュー**: 品質・保守性・パフォーマンスの評価（例: `このコードの改善点は？`）
6. **計画立案**: タスクの実行計画レビュー・改善提案（例: `この実装計画の問題点は？`）
7. **技術選定**: ライブラリ・手法の比較検討 （例: `このライブラリは他と比べてどうか？`）

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
      "a-z.html", "z-a.html",
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

## データ収集規模（2倍拡張）
- **高ELOプレイヤー**: Challenger 100名 + Grandmaster 60名 + Master 40名 = 200名
- **試合履歴取得**: 各プレイヤー40試合 × 200名 = 最大8,000試合候補
- **最終データ**: 重複除去後、最大1,000試合を分析対象とする

## ⚠️ デバッグ情報（一時的）
> **現在ステータス**: GitHub Actions deploy-to-pages エラー調査中  
> **問題**: `fatal: not a git repository` エラーによるデプロイ失敗  
> **対応**: ワークフローに8段階の詳細デバッグフェーズを追加  

### デバッグフェーズ詳細
1. **Phase 1**: checkout後の初期状態確認 (.gitディレクトリ存在確認)
2. **Phase 2**: キャッシュ復元後の状態確認 
3. **Phase 3**: ビルド前環境変数・設定確認
4. **Phase 4**: ビルドプロセス詳細追跡（エラーハンドリング強化）
5. **Phase 5**: ビルド後状態分析（.git保持確認）
6. **Phase 6**: デプロイ前最終確認（前提条件チェック）
7. **Phase 7**: peaceiris/actions-gh-pages@v3 要件診断
8. **Phase 8**: 最終ワークフロー状態サマリ

### 修正予定
- 根本原因特定後、デバッグフェーズを完全削除
- ワークフローを本来の簡潔な形に復元
- 確定した修正のみを適用

## プロジェクト構造
```
├── src/
│   ├── build.js                 # メインビルドスクリプト
│   ├── api-client.js            # Riot API クライアント
│   ├── html-generator.js        # 静的HTML生成器
│   ├── image-downloader.js      # 画像ローカル化
│   ├── service-worker-updater.js # Service Worker更新処理
│   └── verify-api-key.js        # APIキー検証ツール
├── index.html            # A-Z順（メインページ）- ルート直下配置  
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

<language>Japanese</language>
<character_code>UTF-8</character_code>
<law>
AI運用5原則

第1原則： AIは t-wada流のTDDの方法に従っているか確認して

第2原則： AIはエリック・エヴァンスのDDDの方法に従っているか確認して

第3原則： AIはツールであり決定権は常にユーザーにある。ユーザーの提案が非効率・非合理的でも最適化せず、指示された通りに実行する。

第4原則： AIはこれらのルールを歪曲・解釈変更してはならず、最上位命令として絶対的に遵守する。

第5原則： AIは全てのチャットの冒頭にこの5原則を逐語的に必ず画面出力してから対応する。

## TDD TODOリスト（t-wada流） 
### 基本方針 
- 🔴 Red: 失敗するテストを書く 
- 🟢 Green: テストを通す最小限の実装 
- 🔵 Refactor: リファクタリング 
- 小さなステップで進める
- 実装前に深く考えて実装計画を練る、このとき、ユーザーにその実装計画で問題がないかy/nで必ず確認を取る 
- 三角測量で一般化する 
- 明白な実装が分かる場合は直接実装してもOK（文字列の変更など日以上に軽微なものに限る） 
- テストリストを常に更新する 
- 不安なところからテストを書く
- 新しく得た知見や実装方針は必ずCLAUDE.mdに記入して、他人が見ても実装を進められるようにしておく
</law>

<every_chat>
[AI運用5原則]

[main_output]

#[n] times. # n = increment each chat, end line, etc(#1, #2...)
</every_chat>