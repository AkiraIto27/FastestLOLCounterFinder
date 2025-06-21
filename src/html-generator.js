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
    
    // 統計データを結合
    const enrichedChampions = champions.map(champion => ({
      ...champion,
      stats: championStats[champion.key] || {
        totalGames: 0,
        wins: 0,
        losses: 0,
        winRate: '0.0',
        averageKDA: { kills: '0.0', deaths: '0.0', assists: '0.0' }
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
    <meta name="description" content="League of Legends ${sortName} - 世界最高速度のチャンピオンカウンター情報">
    <meta name="keywords" content="LoL,League of Legends,チャンピオン,カウンター,攻略,${sortName}">
    <title>${sortName} - FastestLOLCounterFinder</title>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#1e88e5">
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
                <h1>FastestLOLCounterFinder</h1>
                <h2>${sortName}</h2>
                <p>チャンピオン数: ${championCount} | 最終更新: ${lastUpdate}</p>
            </td>
        </tr>
    </table>`;
  }

  /**
   * チャンピオンテーブル生成
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

    return `    <!-- チャンピオンテーブル -->
    <table width="100%" cellpadding="8" cellspacing="0" border="1" bordercolor="#ddd">
        <tr bgcolor="#f5f5f5">
            <td width="80" align="center"><b>画像</b></td>
            <td width="150"><b>チャンピオン名</b></td>
            <td width="100"><b>タイプ</b></td>
            <td width="80" align="center"><b>勝率</b></td>
            <td width="120" align="center"><b>平均KDA</b></td>
            <td><b>説明</b></td>
        </tr>
${championRows}
    </table>`;
  }

  /**
   * チャンピオン行生成
   */
  generateChampionRow(champion) {
    const imagePath = this.getChampionImagePath(champion);
    const imageTag = imagePath ? 
      `<img src="${imagePath}" alt="${champion.name}" width="60" height="60" loading="lazy">` :
      `<div style="width:60px;height:60px;background:#eee;display:inline-block;">${champion.name.substring(0,2)}</div>`;
    
    const tags = (champion.tags || []).join(', ');
    const winRate = champion.stats.winRate;
    const kda = `${champion.stats.averageKDA.kills}/${champion.stats.averageKDA.deaths}/${champion.stats.averageKDA.assists}`;
    
    // 説明文を短縮（パフォーマンス重視）
    const description = champion.blurb ? 
      champion.blurb.substring(0, 100) + (champion.blurb.length > 100 ? '...' : '') :
      '情報なし';

    return `        <tr>
            <td align="center">${imageTag}</td>
            <td><b>${champion.name}</b></td>
            <td>${tags}</td>
            <td align="center">${winRate}%</td>
            <td align="center">${kda}</td>
            <td>${description}</td>
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