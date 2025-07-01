# FastestLOLCounterFinder - GitHub Actions デプロイメント設定ガイド

## 🚀 自動更新システム概要

このプロジェクトは **1日4回（6時間おき）** にGitHub Actionsで自動実行され、最新のLeague of Legendsカウンター情報を更新します。

### 実行スケジュール
- **00:00 UTC** (日本時間 09:00)
- **06:00 UTC** (日本時間 15:00) 
- **12:00 UTC** (日本時間 21:00)
- **18:00 UTC** (日本時間 03:00)

## ⚙️ セットアップ手順

### 1. Riot API キーの設定

1. [Riot Developer Portal](https://developer.riotgames.com/) でPersonal API Keyを取得
2. GitHubリポジトリの `Settings` > `Secrets and variables` > `Actions` に移動
3. `New repository secret` をクリック
4. 以下を設定:
   - **Name**: `RIOT_API_KEY`
   - **Secret**: あなたのPersonal API Key

### 2. GitHub Pages の有効化

1. リポジトリの `Settings` > `Pages` に移動
2. **Source** を `GitHub Actions` に設定
3. 保存して設定完了

### 3. 初回手動実行（推奨）

1. `Actions` タブに移動
2. `Update Data and Deploy to GitHub Pages` ワークフローを選択
3. `Run workflow` をクリックして手動実行
4. 初回実行の成功を確認

## 📊 モニタリング

### ビルド状況の確認
- `Actions` タブでワークフローの実行状況を確認
- 各ステップの詳細ログを確認可能
- エラー時は詳細なデバッグ情報を出力

### 実行時間目安
- **API データ取得**: 約2-3時間
- **HTML生成**: 約5-10分
- **デプロイ**: 約1-2分
- **合計**: 約3-4時間（6時間制限内で余裕あり）

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. API Key エラー
```
❌ RIOT_API_KEY environment variable is required
```
**解決方法**: GitHub Secretsでのキー設定を確認

#### 2. レート制限エラー  
```
Rate limited, retrying after Xms
```
**解決方法**: 自動リトライで対応。通常は問題なし

#### 3. デプロイ失敗
```
fatal: not a git repository
```
**解決方法**: ワークフローが自動的に対処。バックアップから復旧

#### 4. データ取得失敗
**現象**: 空のキャッシュファイル、HTMLページが生成されない
**解決方法**: 
- バックアップキャッシュから自動復旧
- 次回実行で再試行
- 手動実行での強制更新

## 🛡️ 安全機能

### 二段階キャッシュ更新
1. 新データを `cache.new.json` に一時保存
2. 検証成功後のみ `cache.json` を更新
3. 失敗時は既存データを保持

### エラー時フォールバック
1. API取得失敗時はバックアップキャッシュを使用
2. 完全失敗時も既存サイトを維持
3. 自動復旧とエラー詳細ログ出力

### リソース監視
- メモリ使用量の監視
- 実行時間の追跡
- パフォーマンス評価

## 📝 ログの読み方

### 成功時のログ例
```
✅ RIOT_API_KEY is configured
🌐 Fetching fresh data from Riot API...
✅ API data fetched (8000 calls in 2.5h)
✅ Generated 8 HTML pages
🎉 Build process completed successfully
```

### エラー時のログ例  
```
❌ API fetch failed: Rate limit exceeded
⚠️ API fetch failed, attempting to use backup cache
✅ Using backup cache data
```

## 🔄 手動操作

### 手動でワークフローを実行
1. `Actions` タブ > `Update Data and Deploy to GitHub Pages`
2. `Run workflow` をクリック
3. オプション: `Force full data refresh` をチェックでキャッシュ無視

### 緊急時の対応
1. ワークフローを無効化: `.github/workflows/update-and-deploy.yml` を削除
2. 手動ビルド: ローカルで `npm run build:prod` 実行
3. GitHub Pages設定を `Deploy from a branch` に変更

## 📈 パフォーマンス最適化

### API使用量の監視
- 1日あたり約32,000リクエスト（4回実行）
- Personal API Keyの制限内で運用
- エラー時の自動リトライで安定性確保

### ビルド時間の最適化
- 開発モードでのキャッシュ活用
- 段階的なデータ検証
- 効率的なファイル生成

## 🌐 サイトURL

デプロイ成功後、以下のURLでサイトにアクセス可能:
```
https://[あなたのGitHubユーザー名].github.io/FastestLOLCounterFinder
```

## 📞 サポート

問題が発生した場合:
1. `Actions` タブのログを確認
2. Issue を作成して詳細を報告
3. ワークフローの手動実行を試行

---

**注意**: Personal API Keyには制限があります。本番運用では Production API Key の取得を検討してください。