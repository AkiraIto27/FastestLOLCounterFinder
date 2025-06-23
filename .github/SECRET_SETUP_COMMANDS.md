# GitHub Secrets 設定コマンド

## 必要な設定

リポジトリ: `https://github.com/AkiraIto27/FastestLOLCounterFinder`

### 1. RIOT_API_KEY設定

**ブラウザで設定:**
1. https://github.com/AkiraIto27/FastestLOLCounterFinder/settings/secrets/actions
2. "New repository secret" をクリック
3. Name: `RIOT_API_KEY`
4. Value: あなたのRiot Games APIキー（RGAPI-で始まる）

**GitHub CLI で設定:**
```bash
# GitHub CLI がインストールされている場合
gh secret set RIOT_API_KEY --body "RGAPI-your-actual-api-key-here"
```

### 2. 設定確認

```bash
# GitHub CLI で確認
gh secret list

# 出力例:
# RIOT_API_KEY    Updated 2025-06-23
```

## 重要なポイント

- **APIキーの形式**: `RGAPI-` で始まる文字列
- **有効期限**: Personal API Keyは24時間で期限切れ
- **レート制限**: 20リクエスト/秒、100リクエスト/2分

## 次のステップ

1. 上記でAPIキーを設定
2. ワークフローファイルをコミット・プッシュ
3. GitHub Pagesを有効化
4. 初回実行（手動実行推奨）

## トラブルシューティング

### APIキーエラーの場合
- Riot Developer Portal で新しいキーを生成
- 24時間以内に実行されているか確認
- Secretsの設定が正しいか確認