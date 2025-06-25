# FastestLOL True Static-First セキュリティ設定ガイド

## 🔐 GitHub Actions Secrets（必須設定）

> **重要**: 以下のシークレットをGitHubリポジトリの Settings > Secrets and variables > Actions で設定してください。

### 必須設定
```bash
# API認証情報
RIOT_API_KEY=RGAPI-your-production-key

# 本番制御設定（セキュリティ重要）
DEBUG_MODE=false
VERBOSE_LOGGING=false

# 環境識別
DEPLOYMENT_ENVIRONMENT=production
```

### オプション設定（高可用性）
```bash
# 障害時用バックアップキー
RIOT_API_KEY_BACKUP=RGAPI-backup-key

# 監査用設定
SECURITY_AUDIT_MODE=true
```

## 📊 GitHub Variables

### 地域・環境設定
```bash
# サービス対象地域
TARGET_REGION=jp1
ACCOUNT_REGION=asia

# パフォーマンス目標
TARGET_FIRST_PAINT=100
TARGET_LCP=500
TARGET_CLS=0.1

# キャッシュ管理
SW_CACHE_VERSION=1
```

### 自動化設定
```bash
# ビルド管理
BUILD_NUMBER=auto-increment
BUILD_TIMESTAMP=auto-generated

# 品質管理
ENABLE_PERFORMANCE_AUDIT=true
ENABLE_SECURITY_SCAN=true
```

## 📁 .env ファイル（ローカル開発用）

```bash
# 開発環境のみ
OUTPUT_DIR=./dist
CACHE_DIR=./data
LOCAL_DEBUG_MODE=true
DEV_SERVER_PORT=3000

# ローカルテスト用
TEST_RIOT_API_KEY=RGAPI-dev-key
MOCK_API_RESPONSES=true
```

## 🏗️ ハードコード値（変更不要）

```javascript
// src/config.js
export const CONSTANTS = {
  // Riot公式制限値
  RATE_LIMITS: {
    PER_SECOND: 20,
    PER_2_MINUTES: 100
  },
  
  // API エンドポイント
  RIOT_ENDPOINTS: {
    DDragon: 'https://ddragon.leagueoflegends.com',
    RegionalAPI: (region) => `https://${region}.api.riotgames.com`
  },
  
  // パフォーマンス制限
  MAX_FILE_SIZE: 51200, // 50KB
  IMAGE_QUALITY: 85,
  CACHE_DURATION: 86400000 // 24時間
};
```

### セキュリティ固定値
```javascript
const SECURITY_CONFIG = {
  API_TIMEOUT: 30000,        // APIタイムアウト
  MAX_RETRIES: 3,            // 最大リトライ回数
  RATE_LIMIT_BUFFER: 0.9,    // レート制限バッファ
  CACHE_ENCRYPTION: false,   // キャッシュ暗号化（不要）
  LOG_SANITIZATION: true     // ログ機密情報除去
};
```

## 🔄 セキュリティローテーション計画

### 月次作業
- [ ] API Key の有効性確認
- [ ] 使用量モニタリング
- [ ] 異常アクセス検知

### 四半期作業
- [ ] API Key ローテーション
- [ ] アクセス権限レビュー
- [ ] セキュリティ監査

### 年次作業
- [ ] 全設定値の見直し
- [ ] セキュリティポリシー更新
- [ ] 災害復旧テスト

## ⚠️ セキュリティ警告

### 絶対に避けるべき設定
```bash
❌ Secretsに非機密情報を格納
❌ Variablesに機密情報を格納  
❌ 本番でDEBUG_MODE=true
❌ APIキーをコミットに含める
❌ プルリクエストでの機密情報露出
```

### 緊急時対応
```bash
# APIキー漏洩時の対応
1. 即座にRiot Developer Portalでキー無効化
2. GitHub Secretsから該当キーを削除
3. 新しいキーを生成・設定
4. 全関連サービスの動作確認
5. インシデントレポート作成
```