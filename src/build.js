#!/usr/bin/env node

/**
 * FastestLOLCounterFinder - メインビルドスクリプト
 * Static-Firstアーキテクチャに基づく超高速サイト生成
 */

import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import fs from 'fs-extra';

// モジュールのインポート（後で作成）
import { ApiClient } from './api-client.js';
import { HtmlGenerator } from './html-generator.js';
import { ImageDownloader } from './image-downloader.js';
import { ServiceWorkerUpdater } from './service-worker-updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const PROJECT_ROOT = join(__dirname, '..');

// 環境変数読み込み
config({ path: join(PROJECT_ROOT, '.env') });

/**
 * ビルド設定
 */
const BUILD_CONFIG = {
  isDev: process.argv.includes('--dev'),
  isProd: process.argv.includes('--prod'),
  forceUpdate: process.env.FORCE_UPDATE === 'true',
  outputDir: process.env.OUTPUT_DIR || './dist',
  cacheDir: process.env.CACHE_DIR || './data',
  apiKey: process.env.RIOT_API_KEY,
  targetRegion: process.env.TARGET_REGION || 'jp1',
  accountRegion: process.env.ACCOUNT_REGION || 'asia',
  debug: process.env.DEBUG_MODE === 'true',
  safeMode: true // エラー時の安全な処理を有効化
};

/**
 * ビルド統計
 */
let buildStats = {
  startTime: Date.now(),
  endTime: null,
  duration: null,
  apiCalls: 0,
  htmlGenerated: 0,
  imagesDownloaded: 0,
  totalSize: 0,
  errors: [],
  warnings: [],
  cacheStatus: 'unknown'
};

/**
 * ログ出力
 */
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (level === 'debug' && !BUILD_CONFIG.debug) return;
  
  console.log(prefix, message, ...args);
}

/**
 * ビルド前の検証
 */
async function validateEnvironment() {
  log('info', '=== Environment Validation Started ===');
  
  // Critical: API key validation
  if (!BUILD_CONFIG.apiKey) {
    const error = new Error('❌ RIOT_API_KEY environment variable is required');
    buildStats.errors.push(error.message);
    throw error;
  }
  log('info', '✅ RIOT_API_KEY is configured');
  
  // Directory creation with error handling
  try {
    const cacheDir = join(PROJECT_ROOT, BUILD_CONFIG.cacheDir);
    if (!existsSync(cacheDir)) {
      await fs.ensureDir(cacheDir);
      log('info', `✅ Created cache directory: ${cacheDir}`);
    } else {
      log('info', `✅ Cache directory exists: ${cacheDir}`);
    }
    
    const outputDir = join(PROJECT_ROOT, BUILD_CONFIG.outputDir);
    if (!existsSync(outputDir)) {
      await fs.ensureDir(outputDir);
      log('info', `✅ Created output directory: ${outputDir}`);
    } else {
      log('info', `✅ Output directory exists: ${outputDir}`);
    }
  } catch (error) {
    const errorMsg = `Failed to create directories: ${error.message}`;
    buildStats.errors.push(errorMsg);
    throw new Error(errorMsg);
  }
  
  // System resources check
  try {
    const { execSync } = await import('child_process');
    const memInfo = execSync('free -h 2>/dev/null || echo "Memory info not available"', { encoding: 'utf8' });
    log('debug', `System memory: ${memInfo.split('\n')[1] || 'Unknown'}`);
  } catch (error) {
    log('warn', 'Could not check system resources');
  }
  
  log('info', '=== Environment Validation Completed ===');
}

/**
 * ビルドプロセスの実行
 */
async function executeBuildProcess() {
  log('info', 'Build process started', { config: BUILD_CONFIG });
  
  try {
    // Step 1: APIクライアント初期化
    const apiClient = new ApiClient(BUILD_CONFIG);
    log('info', 'API client initialized');
    
    // Step 2: データ取得または キャッシュ読み込み
    let gameData;
    const cacheFile = join(PROJECT_ROOT, BUILD_CONFIG.cacheDir, 'cache.json');
    
    if (BUILD_CONFIG.isDev && existsSync(cacheFile)) {
      log('info', 'Loading data from cache (dev mode)');
      gameData = await fs.readJson(cacheFile);
    } else {
      log('info', 'Fetching data from Riot API');
      gameData = await apiClient.fetchAllData();
      buildStats.apiCalls = apiClient.getCallCount();
      
      // キャッシュに保存
      await fs.writeJson(cacheFile, gameData, { spaces: 2 });
      log('info', 'Data cached successfully');
    }
    
    // Step 3: 画像ダウンロード
    const imageDownloader = new ImageDownloader(BUILD_CONFIG);
    const imageMap = await imageDownloader.downloadImages(gameData);
    buildStats.imagesDownloaded = Object.keys(imageMap).length;
    log('info', `Downloaded ${buildStats.imagesDownloaded} images`);
    
    // Step 4: HTML生成
    const htmlGenerator = new HtmlGenerator(BUILD_CONFIG, imageMap);
    const pages = await htmlGenerator.generateAllPages(gameData);
    buildStats.htmlGenerated = pages.length;
    
    // Step 5: Service Worker更新
    const swUpdater = new ServiceWorkerUpdater(BUILD_CONFIG);
    await swUpdater.updateServiceWorker();
    
    // Step 6: ビルド統計計算
    await calculateBuildStats();
    
    log('info', 'Build process completed successfully');
    
  } catch (error) {
    log('error', 'Build process failed:', error.message);
    if (BUILD_CONFIG.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * ビルド統計の計算
 */
async function calculateBuildStats() {
  const outputPath = join(PROJECT_ROOT, BUILD_CONFIG.outputDir);
  
  try {
    // ディレクトリサイズ計算
    const stats = await fs.stat(outputPath);
    buildStats.totalSize = await calculateDirectorySize(outputPath);
    buildStats.duration = Date.now() - buildStats.startTime;
    
    log('info', 'Build Statistics:', {
      duration: `${buildStats.duration}ms`,
      apiCalls: buildStats.apiCalls,
      htmlPages: buildStats.htmlGenerated,
      images: buildStats.imagesDownloaded,
      totalSize: `${(buildStats.totalSize / 1024).toFixed(2)}KB`
    });
    
  } catch (error) {
    log('warn', 'Failed to calculate build statistics:', error.message);
  }
}

/**
 * ディレクトリサイズ計算
 */
async function calculateDirectorySize(dirPath) {
  let totalSize = 0;
  
  const files = await fs.readdir(dirPath);
  
  for (const file of files) {
    const filePath = join(dirPath, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory()) {
      totalSize += await calculateDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

/**
 * メイン実行
 */
async function main() {
  try {
    log('info', '=== FastestLOLCounterFinder Build Started ===');
    
    await validateEnvironment();
    await executeBuildProcess();
    
    log('info', '=== Build Completed Successfully ===');
    
  } catch (error) {
    log('error', 'Build failed:', error.message);
    process.exit(1);
  }
}

// 直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, BUILD_CONFIG };