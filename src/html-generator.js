/**
 * 静的HTMLジェネレーター
 * 阿部寛氏公式サイトを思想とする極限軽量化HTMLの生成
 */

import fs from 'fs-extra';
import { join } from 'path';

export class HtmlGenerator {
  constructor(config, imageMap) {
    this.config = config;
    this.imageMap = imageMap;
    this.outputDir = join(process.cwd(), config.outputDir);
    this.templatesDir = join(process.cwd(), 'templates');
    
    // ソート設定
    this.sortTypes = {
      'index': { name: '新着順', sort: this.sortByRecent.bind(this) },
      'a-z': { name: 'A-Z順', sort: this.sortByNameAsc.bind(this) },
      'z-a': { name: 'Z-A順', sort: this.sortByNameDesc.bind(this) },
      'category-assassin': { name: 'アサシン', sort: this.sortByCategory.bind(this, 'Assassin') },
      'category-fighter': { name: 'ファイター', sort: this.sortByCategory.bind(this, 'Fighter') },
      'category-mage': { name: 'メイジ', sort: this.sortByCategory.bind(this, 'Mage') },
      'category-marksman': { name: 'マークスマン', sort: this.sortByCategory.bind(this, 'Marksman') },
      'category-support': { name: 'サポート', sort: this.sortByCategory.bind(this, 'Support') },
      'category-tank': { name: 'タンク', sort: this.sortByCategory.bind(this, 'Tank') }
    };
  }

  /**
   * 全ページ生成
   */
  async generateAllPages(gameData) {
    this.log('info', 'Starting HTML generation for all pages');
    
    const generatedPages = [];
    
    try {
      // 各ソート順でHTMLページを生成
      for (const [sortKey, sortConfig] of Object.entries(this.sortTypes)) {
        const fileName = sortKey === 'index' ? 'index.html' : `${sortKey}.html`;
        const filePath = join(this.outputDir, fileName);
        
        this.log('info', `Generating ${fileName}`);
        
        // データソート
        const sortedChampions = this.sortChampions(gameData, sortConfig.sort);
        
        // HTML生成
        const htmlContent = this.generatePageHtml(
          sortedChampions,
          gameData,
          sortConfig.name,
          sortKey
        );
        
        // ファイル書き込み
        await fs.writeFile(filePath, htmlContent, 'utf8');
        
        generatedPages.push({
          fileName,
          sortType: sortKey,
          championCount: sortedChampions.length
        });
        
        this.log('debug', `Generated ${fileName} with ${sortedChampions.length} champions`);
      }
      
      // PWA manifest生成
      await this.generateManifest();
      
      this.log('info', `HTML generation completed. Generated ${generatedPages.length} pages`);
      return generatedPages;
      
    } catch (error) {
      this.log('error', 'HTML generation failed:', error.message);
      throw error;
    }
  }

  /**
   * チャンピオンデータソート
   */
  sortChampions(gameData, sortFunction) {
    const champions = Object.values(gameData.champions || {});
    const championStats = gameData.championStats || {};
    
    // 統計データを結合（champion.idをキーとして使用）
    const enrichedChampions = champions.map(champion => ({
      ...champion,
      stats: championStats[champion.id] || {
        totalGames: 0,
        wins: 0,
        losses: 0,
        winRate: '0.0',
        averageKDA: { kills: '0.0', deaths: '0.0', assists: '0.0' },
        counters: []
      }
    }));
    
    return sortFunction(enrichedChampions);
  }

  /**
   * ソート関数群
   */
  sortByRecent(champions) {
    // 新着順（今回はランダム順をシミュレート）
    return champions.sort(() => Math.random() - 0.5);
  }

  sortByNameAsc(champions) {
    return champions.sort((a, b) => a.name.localeCompare(b.name));
  }

  sortByNameDesc(champions) {
    return champions.sort((a, b) => b.name.localeCompare(a.name));
  }

  sortByCategory(category, champions) {
    return champions
      .filter(champion => champion.tags && champion.tags.includes(category))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * HTMLページ生成
   */
  generatePageHtml(champions, gameData, sortName, sortKey) {
    const metadata = gameData.metadata || {};
    const navigationHtml = this.generateNavigation(sortKey);
    const headerHtml = this.generateHeader(sortName, champions.length, metadata);
    const contentHtml = this.generateChampionTable(champions);
    const footerHtml = this.generateFooter(metadata);
    const swScript = this.generateServiceWorkerScript();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="League of Legends ${sortName} カウンター情報 - 世界最高速度でカウンターピックを検索">
    <meta name="keywords" content="LoL,League of Legends,チャンピオン,カウンター,カウンターピック,攻略,${sortName}">
    <title>${sortName} カウンター - FastestLOLCounterFinder</title>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#e53e3e">
</head>
<body>
    ${navigationHtml}
    ${headerHtml}
    ${contentHtml}
    ${footerHtml}
    ${swScript}
</body>
</html>`;
  }

  /**
   * ナビゲーション生成
   */
  generateNavigation(currentSort) {
    const navItems = Object.entries(this.sortTypes).map(([key, config]) => {
      const href = key === 'index' ? '/' : `/${key}.html`;
      const isCurrent = key === currentSort;
      const style = isCurrent ? ' bgcolor="#e3f2fd"' : '';
      
      return `            <td${style}><a href="${href}">${config.name}</a></td>`;
    }).join('\n');

    return `    <!-- ナビゲーション -->
    <table width="100%" cellpadding="8" cellspacing="0" border="1" bordercolor="#ccc">
        <tr>
${navItems}
        </tr>
    </table>`;
  }

  /**
   * ヘッダー生成
   */
  generateHeader(sortName, championCount, metadata) {
    const lastUpdate = metadata.fetchTime ? 
      new Date(metadata.fetchTime).toLocaleString('ja-JP') : '不明';
    
    return `    <!-- ヘッダー -->
    <table width="100%" cellpadding="16" cellspacing="0" border="0">
        <tr>
            <td align="center">
                <h1>⚡ FastestLOLCounterFinder</h1>
                <h2>🛡️ ${sortName} カウンター情報</h2>
                <p><b>チャンピオン数: ${championCount} | 最終更新: ${lastUpdate}</b></p>
                <p><small>敵チャンピオンを選択して、カウンターピックを瞬時に確認しよう！</small></p>
            </td>
        </tr>
    </table>`;
  }

  /**
   * チャンピオンテーブル生成（カウンター特化）
   */
  generateChampionTable(champions) {
    if (champions.length === 0) {
      return `    <!-- コンテンツ -->
    <table width="100%" cellpadding="16" cellspacing="0" border="0">
        <tr>
            <td align="center">
                <p>このカテゴリにはチャンピオンが存在しません。</p>
            </td>
        </tr>
    </table>`;
    }

    const championRows = champions.map(champion => 
      this.generateChampionRow(champion)
    ).join('\n');

    return `    <!-- カウンターチャンピオンテーブル -->
    <table width="100%" cellpadding="8" cellspacing="0" border="1" bordercolor="#ddd">
        <tr bgcolor="#f5f5f5">
            <td width="80" align="center"><b>画像</b></td>
            <td width="150"><b>チャンピオン名</b></td>
            <td><b>カウンター関係</b></td>
        </tr>
${championRows}
    </table>`;
  }

  /**
   * チャンピオン行生成（カウンター特化）
   */
  generateChampionRow(champion) {
    // 非同期画像読み込み用のプレースホルダーとimage要素を生成
    const championId = champion.id; // チャンピオン名（Ahri, Yasuo等）を使用
    const imageSrc = `/images/champion/square/${championId}.png`;
    
    // プレースホルダーから画像への非同期切り替え
    const imageTag = `<div class="champion-image-container" style="width:60px;height:60px;position:relative;display:inline-block;">
      <div class="champion-placeholder" style="width:60px;height:60px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:12px;color:#666;">${champion.name.substring(0,2)}</div>
      <img class="champion-image" src="${imageSrc}" alt="${champion.name}" width="60" height="60" style="position:absolute;top:0;left:0;display:none;" onload="this.style.display='block';this.previousElementSibling.style.display='none';" onerror="this.style.display='none';">
    </div>`;
    
    const tags = (champion.tags || []).join(', ');
    
    // 新しいカウンター情報を取得
    const counterData = champion.stats?.counterData || { strongAgainst: [], weakAgainst: [] };
    const strongCounters = counterData.strongAgainst || [];
    const weakCounters = counterData.weakAgainst || [];
    
    // フォーマット: "${チャンピオン名}が←強い　弱い→"
    const strongText = strongCounters.length > 0 ? strongCounters.join(', ') : '算出中';
    const weakText = weakCounters.length > 0 ? weakCounters.join(', ') : '算出中';
    
    const counterDisplayText = `${champion.name}が（←強い　弱い→） </br><b style="color:#2e7d32;">${strongText}</b>　<b style="color:#e53e3e;">${weakText}</b>`;

    return `        <tr>
            <td align="center">${imageTag}</td>
            <td><b>${champion.name}</b></td>
            <td>${counterDisplayText}</td>
        </tr>`;
  }

  /**
   * チャンピオン画像パス取得
   */
  getChampionImagePath(champion) {
    if (this.imageMap && 
        this.imageMap.champions && 
        this.imageMap.champions[champion.key] &&
        this.imageMap.champions[champion.key].square) {
      return this.imageMap.champions[champion.key].square;
    }
    return null;
  }

  /**
   * フッター生成
   */
  generateFooter(metadata) {
    const version = metadata.version || '不明';
    const region = metadata.region || '不明';
    
    return `    <!-- フッター -->
    <table width="100%" cellpadding="16" cellspacing="0" border="0">
        <tr>
            <td align="center">
                <hr>
                <p>
                    <small>
                        FastestLOLCounterFinder | 
                        Data Version: ${version} | 
                        Region: ${region.toUpperCase()} | 
                        Generated: ${new Date().toLocaleString('ja-JP')}
                    </small>
                </p>
                <p>
                    <small>
                        ※ データはRiot Games APIから取得しています。<br>
                        ※ 本サイトはRiot Gamesが承認または後援したものではありません。
                    </small>
                </p>
            </td>
        </tr>
    </table>`;
  }

  /**
   * Service Worker登録スクリプト生成
   */
  generateServiceWorkerScript() {
    return `    <!-- Service Worker登録（非同期実行） -->
    <script>
        // Service Worker登録（ページ読み込み完了後に非同期実行）
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    console.log('SW registered:', registration.scope);
                    
                    // 更新チェック
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('New version available. Refresh to update.');
                            }
                        });
                    });
                } catch (error) {
                    console.error('SW registration failed:', error);
                }
            });
        }

        // 画像遅延読み込み最適化（表示速度に影響しない非同期処理）
        document.addEventListener('DOMContentLoaded', () => {
            // Intersection Observer APIを使用して可視領域内の画像のみ優先読み込み
            if ('IntersectionObserver' in window) {
                const imageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target.querySelector('.champion-image');
                            if (img && !img.dataset.loaded) {
                                img.dataset.loaded = 'true';
                                // 画像が既に読み込まれていない場合のみ処理
                                if (img.complete && img.naturalHeight !== 0) {
                                    img.onload();
                                }
                            }
                            imageObserver.unobserve(entry.target);
                        }
                    });
                }, {
                    rootMargin: '50px 0px', // 50px手前から読み込み開始
                    threshold: 0.1
                });

                // 全てのチャンピオン画像コンテナを監視
                document.querySelectorAll('.champion-image-container').forEach(container => {
                    imageObserver.observe(container);
                });
            }
        });
    </script>`;
  }

  /**
   * PWA Manifest生成
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
      categories: ["games", "sports"],
      lang: "ja",
      icons: [
        {
          src: "/images/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        }
      ]
    };

    const manifestPath = join(this.outputDir, 'manifest.json');
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    
    this.log('debug', 'PWA manifest generated');
  }

  /**
   * ページサイズ計算
   */
  calculatePageSize(htmlContent) {
    return Buffer.byteLength(htmlContent, 'utf8');
  }

  /**
   * パフォーマンス検証
   */
  validatePerformance(htmlContent, sortType) {
    const size = this.calculatePageSize(htmlContent);
    const maxSize = this.config.performance?.maxInitialPageSize || 51200; // 50KB
    
    const validation = {
      sortType,
      size,
      maxSize,
      isValid: size <= maxSize,
      hasNoCSS: !htmlContent.includes('<style') && !htmlContent.includes('.css'),
      hasNoBlockingJS: !htmlContent.includes('<script') || 
                       htmlContent.match(/<script[^>]*>/g)?.every(tag => 
                         tag.includes('async') || tag.includes('defer') || 
                         htmlContent.indexOf(tag) > htmlContent.lastIndexOf('</body>') - 500
                       ),
      hasLazyImages: htmlContent.includes('loading="lazy"')
    };

    if (!validation.isValid) {
      this.log('warn', `Performance warning for ${sortType}: Size ${size} bytes exceeds limit ${maxSize} bytes`);
    }

    return validation;
  }

  /**
   * ログ出力
   */
  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [HTML-GENERATOR] [${level.toUpperCase()}]`;
    
    if (level === 'debug' && !this.config.debug) return;
    
    console.log(prefix, message, ...args);
  }
}