/**
 * Service Worker更新管理
 * Cache First戦略によるオフライン対応とキャッシュ管理
 */

import fs from 'fs-extra';
import { join } from 'path';
import { glob } from 'glob';

export class ServiceWorkerUpdater {
  constructor(config) {
    this.config = config;
    this.outputDir = join(process.cwd(), config.outputDir);
    this.swPath = join(this.outputDir, 'sw.js');
    this.version = process.env.SW_CACHE_VERSION || Date.now().toString();
  }

  /**
   * Service Worker更新
   */
  async updateServiceWorker() {
    this.log('info', 'Updating Service Worker');
    
    try {
      // キャッシュ対象ファイルの収集
      const filesToCache = await this.collectFilesToCache();
      
      // Service Workerコード生成
      const swCode = this.generateServiceWorkerCode(filesToCache);
      
      // Service Workerファイル書き込み
      await fs.writeFile(this.swPath, swCode, 'utf8');
      
      this.log('info', `Service Worker updated with ${filesToCache.length} files to cache`);
      
    } catch (error) {
      this.log('error', 'Failed to update Service Worker:', error.message);
      throw error;
    }
  }

  /**
   * キャッシュ対象ファイル収集
   */
  async collectFilesToCache() {
    const patterns = [
      '*.html',
      'images/**/*.{png,jpg,jpeg,gif,webp}',
      '*.js',
      '*.css',
      '*.json'
    ];

    const allFiles = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { 
          cwd: this.outputDir,
          nodir: true 
        });
        allFiles.push(...files);
      } catch (error) {
        this.log('warn', `Failed to glob pattern ${pattern}:`, error.message);
      }
    }

    // 重複除去とソート
    const uniqueFiles = [...new Set(allFiles)].sort();
    
    this.log('debug', `Found ${uniqueFiles.length} files to cache`);
    
    return uniqueFiles;
  }

  /**
   * Service Workerコード生成
   */
  generateServiceWorkerCode(filesToCache) {
    const cacheName = `fastest-lol-counter-v${this.version}`;
    const fileList = JSON.stringify(filesToCache, null, 2);

    return `/**
 * FastestLOLCounterFinder Service Worker
 * Cache First Strategy for Maximum Performance
 * Auto-generated on ${new Date().toISOString()}
 * Version: ${this.version}
 */

const CACHE_NAME = '${cacheName}';
const CACHE_VERSION = '${this.version}';

// キャッシュ対象ファイル一覧
const FILES_TO_CACHE = ${fileList};

// インストール時の処理
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[SW] Opened cache:', CACHE_NAME);
        
        // 全ファイルをプリキャッシュ
        await cache.addAll(FILES_TO_CACHE);
        console.log('[SW] All files cached successfully');
        
        // 即座にアクティベート
        await self.skipWaiting();
        
      } catch (error) {
        console.error('[SW] Failed to cache files:', error);
      }
    })()
  );
});

// アクティベート時の処理
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  
  event.waitUntil(
    (async () => {
      try {
        // 古いキャッシュをクリーンアップ
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name.startsWith('fastest-lol-counter-') && name !== CACHE_NAME
        );
        
        await Promise.all(
          oldCaches.map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
        );
        
        // 全クライアントを制御下に置く
        await self.clients.claim();
        
        console.log('[SW] Service Worker activated successfully');
        
      } catch (error) {
        console.error('[SW] Failed to activate:', error);
      }
    })()
  );
});

// フェッチ時の処理（Cache First戦略）
self.addEventListener('fetch', (event) => {
  // HTMLファイルの場合は特別処理
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }
  
  // 静的リソースはCache First
  event.respondWith(handleStaticRequest(event.request));
});

/**
 * ナビゲーションリクエスト処理
 */
async function handleNavigationRequest(request) {
  try {
    // ネットワークから最新を取得を試行
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network failed for navigation:', error.message);
  }
  
  // ネットワーク失敗時はキャッシュから
  const cache = await caches.open(CACHE_NAME);
  
  // 要求されたURLに対応するHTMLファイルを検索
  const url = new URL(request.url);
  let cachedResponse;
  
  // 正確なパスマッチを試行
  cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // パス正規化してマッチを試行
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  cachedResponse = await cache.match(pathname);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // フォールバック: index.htmlを返す
  cachedResponse = await cache.match('/index.html');
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // 全て失敗した場合はエラーページ
  return new Response(
    createOfflineHTML(),
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

/**
 * 静的リソースリクエスト処理（Cache First）
 */
async function handleStaticRequest(request) {
  try {
    // まずキャッシュから確認
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // キャッシュにない場合はネットワークから取得
    console.log('[SW] Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // レスポンスが有効で、GETリクエストの場合はキャッシュに保存
    if (networkResponse && 
        networkResponse.status === 200 && 
        request.method === 'GET') {
      
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
      console.log('[SW] Cached new resource:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Failed to handle request:', request.url, error);
    
    // 画像の場合は代替画像を返す
    if (request.url.includes('/images/')) {
      return createPlaceholderImage();
    }
    
    // その他は基本エラーレスポンス
    return new Response('Resource not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * オフライン用HTMLページ生成
 */
function createOfflineHTML() {
  return \`<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>オフライン - FastestLOLCounterFinder</title>
</head>
<body>
    <table width="100%" cellpadding="20" cellspacing="0" border="0">
        <tr>
            <td align="center">
                <h1>オフラインモード</h1>
                <p>インターネット接続が利用できません。</p>
                <p>キャッシュされたページは引き続き利用可能です。</p>
                <p><a href="/">ホームページに戻る</a></p>
            </td>
        </tr>
    </table>
</body>
</html>\`;
}

/**
 * プレースホルダー画像生成
 */
function createPlaceholderImage() {
  // 1x1の透明PNG
  const transparentPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  return new Response(
    Uint8Array.from(atob(transparentPNG), c => c.charCodeAt(0)),
    {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600'
      }
    }
  );
}

// メッセージ処理
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker script loaded. Version:', CACHE_VERSION);`;
  }

  /**
   * HTMLファイルにService Worker登録スクリプト埋め込み
   */
  async embedServiceWorkerRegistration(htmlContent) {
    const registrationScript = `
    <script>
      // Service Worker登録（非同期、ページ読み込み完了後）
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
          try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration.scope);
            
            // 更新チェック
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('New Service Worker available. Page will refresh on next visit.');
                  } else {
                    console.log('Service Worker installed for the first time.');
                  }
                }
              });
            });
            
          } catch (error) {
            console.error('Service Worker registration failed:', error);
          }
        });
      }
    </script>`;

    // </body>タグの直前に挿入
    return htmlContent.replace('</body>', `${registrationScript}\n</body>`);
  }

  /**
   * マニフェストファイル生成
   */
  async generateManifest() {
    const manifest = {
      name: "FastestLOLCounterFinder",
      short_name: "LOLCounter",
      description: "世界最高速度のLeague of Legendsカウンター情報サイト",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#1e88e5",
      orientation: "portrait-primary",
      icons: [
        {
          src: "/images/icon-192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "/images/icon-512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ],
      categories: ["games", "sports"],
      lang: "ja"
    };

    const manifestPath = join(this.outputDir, 'manifest.json');
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    
    this.log('info', 'PWA manifest generated');
  }

  /**
   * ログ出力
   */
  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [SW-UPDATER] [${level.toUpperCase()}]`;
    
    if (level === 'debug' && !this.config.debug) return;
    
    console.log(prefix, message, ...args);
  }
}