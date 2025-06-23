# GitHub Pages 設定手順

## 1. GitHub Secrets設定

リポジトリの Settings > Secrets and variables > Actions で以下を設定：

```
Name: RIOT_API_KEY
Value: RGAPI-your-actual-api-key-here
```

## 2. GitHub Pages有効化

1. リポジトリの **Settings** > **Pages** に移動
2. **Source** を "Deploy from a branch" に設定
3. **Branch** を "gh-pages" に設定（初回実行後に作成されます）
4. **Folder** を "/ (root)" に設定

## 3. ワークフロー有効化

```bash
# このファイルをコミット・プッシュすると自動で有効化されます
git add .github/workflows/update-site.yml
git commit -m "Add GitHub Actions workflow for automated updates"
git push origin main
```

## 4. 自動実行スケジュール

| 時刻 (JST) | 実行タイミング | 目的 |
|------------|----------------|------|
| 06:00 | 朝の更新 | 新パッチ・チャンピオン対応 |
| 12:00 | 昼の更新 | ランク変動・統計更新 |
| 18:00 | 夕の更新 | プライムタイム前更新 |
| 24:00 | 深夜更新 | 日次データ確定 |

## 5. 手動実行方法

### GitHub Web UI
1. **Actions** タブを開く
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

## 6. サイトURL

設定完了後、以下のURLでアクセス可能：
```
https://[あなたのGitHubユーザー名].github.io/FastestLOLCounterFinder
```