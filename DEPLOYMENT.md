# FastestLOL True Static-First 自動デプロイ設定ガイド

> **アーキテクチャ**: True Static-First + Zero-JS + Cache-First  
> **更新頻度**: 1日4回（6時間間隔）  
> **パフォーマンス**: First Paint <100ms, LCP <200ms, CLS ~0.02

## 🚀 設定手順

### 1. GitHub Secretsの設定
```bash
# GitHubリポジトリで以下を設定:
# Settings > Secrets and variables > Actions > New repository secret

RIOT_API_KEY=RGAPI-your-actual-api-key-here
```

### 2. .gitignoreの更新
```bash
# 推奨設定を適用
cp .gitignore.recommended .gitignore
git add .gitignore
git commit -m "Update .gitignore for static site deployment"
```

### 3. GitHub Pagesの有効化
```bash
# GitHubリポジトリで設定:
# Settings > Pages > Source: Deploy from a branch
# Branch: gh-pages (自動作成される)
# Folder: / (root)
```

### 4. ワークフローの有効化
```bash
# .github/workflows/ディレクトリを作成
mkdir -p .github/workflows

# ワークフローファイルをコミット
git add .github/workflows/update-site.yml
git commit -m "Add automated build and deployment workflow"
git push origin main
```

## ⏰ True Static-First自動更新スケジュール

| 時刻 (JST) | 実行タイミング | 処理内容 | 推定時間 |
|------------|----------------|----------|----------|
| 06:00 | 朝の更新 | 🌅 夜間データ収集・カウンター分析 | ~15分 |
| 12:00 | 昼の更新 | 🌞 ランク変動反映・メタ分析 | ~12分 |
| 18:00 | 夕の更新 | 🌇 プライムタイム前最新化 | ~10分 |
| 24:00 | 深夜更新 | 🌙 日次統計確定・完全再構築 | ~20分 |

### 📊 ビルド処理フロー
1. **API データ収集** (5-10分)
2. **統計計算・分析** (2-3分)
3. **HTML生成** (2-5分) → 170+ページ
4. **デプロイメント** (1-2分)
5. **品質検証** (1分)

## 🔧 手動実行方法

### GitHub Web UI
1. Actions タブを開く
2. "Update LOL Counter Site" ワークフローを選択
3. "Run workflow" ボタンをクリック
4. Build type (dev/prod) を選択して実行

### GitHub CLI
```bash
# 本番ビルド実行
gh workflow run update-site.yml -f build_type=prod

# 開発ビルド実行  
gh workflow run update-site.yml -f build_type=dev
```

## 📊 監視とトラブルシューティング

### 成功確認方法
- ✅ GitHub Pages URL でサイトが更新されている
- ✅ Actions ページで緑のチェックマーク
- ✅ 新しいコミットが gh-pages ブランチに作成

### よくある問題
1. **API Key エラー**: `RIOT_API_KEY` secret が未設定
2. **レート制限**: API呼び出し間隔を調整 (cron設定変更)
3. **ビルド失敗**: package.json や src/ の変更確認

### パフォーマンス監視
- First Paint: 100ms以下目標
- Total size: 50KB以下 (index.html)
- Images: 遅延ロード対応

## 🎯 最適化のポイント

### キャッシュ戦略
- `data/cache.json`: API レスポンスキャッシュ
- `dist/images/`: チャンピオン画像キャッシュ  
- Actions cache で高速化

### コスト最適化
- 無料枠: 月2,000分 (約30%使用)
- スケジュール: 最適な間隔で実行
- 差分ビルド: 変更時のみ画像更新

## 🔒 セキュリティ
- API Key は GitHub Secrets で保護
- 環境変数は実行時のみ利用
- ログに機密情報は出力しない