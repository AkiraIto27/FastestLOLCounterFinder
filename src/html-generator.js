/**
 * 完全静的HTMLジェネレーター - True Static-First実装
 * ゼロJS・ゼロCSS制約下での最速表示を実現
 * 全データをHTMLテーブルとして事前生成、瞬間表示対応
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
   * 全ページ生成 - True Static-First完全実装
   */
  async generateAllPages(gameData) {
    this.log('info', 'Starting True Static-First HTML generation');
    
    const generatedPages = [];
    const champions = gameData.championStats || gameData.processedCounters || {};
    
    try {
      // Phase 1: メインページ生成（一覧ページ）
      await this.generateListingPages(gameData, generatedPages);
      
      // Phase 2: チャンピオン詳細ページ生成（個別ページ）
      await this.generateChampionDetailPages(champions, gameData, generatedPages);
      
      // Phase 3: 検索結果ページ生成（静的検索対応）
      await this.generateSearchPages(champions, gameData, generatedPages);
      
      // Phase 4: PWA対応ファイル生成
      await this.generatePWAFiles();
      
      this.log('info', `True Static-First generation completed. Generated ${generatedPages.length} pages`);
      return generatedPages;
      
    } catch (error) {
      this.log('error', 'HTML generation failed:', error.message);
      throw error;
    }
  }
  
  /**
   * 一覧ページ生成
   */
  async generateListingPages(gameData, generatedPages) {
    this.log('info', 'Generating listing pages');
    
    // 各ソート順でHTMLページを生成
    for (const [sortKey, sortConfig] of Object.entries(this.sortTypes)) {
      const fileName = sortKey === 'index' ? 'index.html' : `${sortKey}.html`;
      const filePath = join(this.outputDir, fileName);
      
      this.log('debug', `Generating listing page: ${fileName}`);
      
      // データソート
      const sortedChampions = this.sortChampions(gameData, sortConfig.sort);
      
      // 軽量一覧HTML生成（エントリーポイント用）
      const htmlContent = this.generateListingPageHtml(
        sortedChampions,
        gameData,
        sortConfig.name,
        sortKey
      );
      
      // ファイル書き込み
      await fs.writeFile(filePath, htmlContent, 'utf8');
      
      generatedPages.push({
        fileName,
        type: 'listing',
        sortType: sortKey,
        championCount: sortedChampions.length,
        size: Buffer.byteLength(htmlContent, 'utf8')
      });
    }
  }
  
  /**
   * チャンピオン詳細ページ生成（個別フルデータ）
   */
  async generateChampionDetailPages(champions, gameData, generatedPages) {
    this.log('info', 'Generating champion detail pages');
    
    for (const [championId, championData] of Object.entries(champions)) {
      const championName = championData.name || championData.id;
      const fileName = `${championId.toLowerCase()}.html`;
      const filePath = join(this.outputDir, fileName);
      
      this.log('debug', `Generating detail page: ${fileName}`);
      
      // 完全詳細HTML生成
      const htmlContent = this.generateChampionDetailHtml(
        championData,
        gameData,
        champions
      );
      
      await fs.writeFile(filePath, htmlContent, 'utf8');
      
      generatedPages.push({
        fileName,
        type: 'detail',
        championId,
        championName,
        size: Buffer.byteLength(htmlContent, 'utf8')
      });
    }
  }
  
  /**
   * 検索結果ページ生成（静的検索実装）
   */
  async generateSearchPages(champions, gameData, generatedPages) {
    this.log('info', 'Generating static search pages');
    
    // アルファベット別検索ページ
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i).toLowerCase(); // a-z
      const fileName = `search-${letter}.html`;
      const filePath = join(this.outputDir, fileName);
      
      const matchingChampions = Object.values(champions).filter(champ => 
        champ.name && champ.name.toLowerCase().startsWith(letter)
      );
      
      if (matchingChampions.length > 0) {
        const htmlContent = this.generateSearchPageHtml(
          matchingChampions,
          `「${letter.toUpperCase()}」で始まるチャンピオン`,
          `search-${letter}`,
          gameData
        );
        
        await fs.writeFile(filePath, htmlContent, 'utf8');
        
        generatedPages.push({
          fileName,
          type: 'search',
          searchType: 'letter',
          searchValue: letter,
          championCount: matchingChampions.length,
          size: Buffer.byteLength(htmlContent, 'utf8')
        });
      }
    }
    
    // レーン別検索ページ
    const lanes = ['TOP', 'MIDDLE', 'BOTTOM', 'JUNGLE', 'UTILITY'];
    for (const lane of lanes) {
      const fileName = `lane-${lane.toLowerCase()}.html`;
      const filePath = join(this.outputDir, fileName);
      
      const laneChampions = Object.values(champions).filter(champ => 
        champ.lanePerformance && champ.lanePerformance[lane]
      );
      
      if (laneChampions.length > 0) {
        const htmlContent = this.generateLanePageHtml(
          laneChampions,
          lane,
          gameData
        );
        
        await fs.writeFile(filePath, htmlContent, 'utf8');
        
        generatedPages.push({
          fileName,
          type: 'lane',
          lane: lane,
          championCount: laneChampions.length,
          size: Buffer.byteLength(htmlContent, 'utf8')
        });
      }
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
   * 一覧ページHTML生成（軽量版・エントリーポイント）
   */
  generateListingPageHtml(champions, gameData, sortName, sortKey) {
    const metadata = gameData.metadata || {};
    const navigationHtml = this.generateNavigation(sortKey);
    const headerHtml = this.generateHeader(sortName, champions.length, metadata);
    const contentHtml = this.generateChampionListingTable(champions); // 軽量版テーブル
    const footerHtml = this.generateFooter(metadata);
    const swScript = this.generateServiceWorkerScript();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${sortName} League of Legends カウンター情報 - 世界最速表示">
<title>${sortName} - FastestLOL</title>
<link rel="manifest" href="manifest.json">
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
   * チャンピオン詳細ページHTML生成（フルデータ）
   */
  generateChampionDetailHtml(championData, gameData, allChampions) {
    const metadata = gameData.metadata || {};
    const championName = championData.name || championData.id;
    
    const navigationHtml = this.generateDetailNavigation(championData, allChampions);
    const championHeaderHtml = this.generateChampionHeader(championData, metadata);
    const overallStatsHtml = this.generateOverallStatsTable(championData);
    const counterTableHtml = this.generateFullCounterTable(championData);
    const lanePerformanceHtml = this.generateLanePerformanceTable(championData);
    const footerHtml = this.generateFooter(metadata);
    const swScript = this.generateServiceWorkerScript();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${championName} カウンター情報 - 勝率・対面データ完全分析">
<title>${championName} カウンター詳細 - FastestLOL</title>
<link rel="manifest" href="manifest.json">
</head>
<body>
${navigationHtml}
${championHeaderHtml}
${overallStatsHtml}
${counterTableHtml}
${lanePerformanceHtml}
${footerHtml}
${swScript}
</body>
</html>`;
  }
  
  /**
   * 検索ページHTML生成
   */
  generateSearchPageHtml(champions, searchTitle, searchKey, gameData) {
    const metadata = gameData.metadata || {};
    const navigationHtml = this.generateSearchNavigation(searchKey);
    const headerHtml = this.generateSearchHeader(searchTitle, champions.length);
    const contentHtml = this.generateChampionListingTable(champions);
    const footerHtml = this.generateFooter(metadata);
    const swScript = this.generateServiceWorkerScript();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${searchTitle} 検索結果 - League of Legends カウンター情報">
<title>${searchTitle} - FastestLOL</title>
<link rel="manifest" href="manifest.json">
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
   * レーンページHTML生成
   */
  generateLanePageHtml(champions, lane, gameData) {
    const metadata = gameData.metadata || {};
    const laneNameJP = this.getLaneNameJP(lane);
    const navigationHtml = this.generateLaneNavigation(lane);
    const headerHtml = this.generateLaneHeader(laneNameJP, champions.length);
    const contentHtml = this.generateLaneChampionTable(champions, lane);
    const footerHtml = this.generateFooter(metadata);
    const swScript = this.generateServiceWorkerScript();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${laneNameJP}レーン チャンピオン一覧 - League of Legends">
<title>${laneNameJP}レーン - FastestLOL</title>
<link rel="manifest" href="manifest.json">
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
   * ナビゲーション生成（軽量化）
   */
  generateNavigation(currentSort) {
    const navItems = Object.entries(this.sortTypes).map(([key, config]) => {
      const href = key === 'index' ? 'index.html' : `${key}.html`;
      const isCurrent = key === currentSort;
      const style = isCurrent ? ' bgcolor="#e3f2fd"' : '';
      
      return `<td${style}><a href="${href}">${config.name}</a></td>`;
    }).join('\n');

    return `<table width="100%" border="1">
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
   * チャンピオン一覧テーブル生成（軽量版）
   */
  generateChampionListingTable(champions) {
    if (champions.length === 0) {
      return `<table width="100%" border="1">
<tr><td align="center">該当チャンピオンなし</td></tr>
</table>`;
    }

    const championRows = champions.map(champion => 
      this.generateChampionListingRow(champion)
    ).join('\n');

    return `<table width="100%" border="1">
<tr bgcolor="#f0f0f0">
<td width="120"><b>チャンピオン</b></td>
<td><b>勝率</b></td>
<td><b>強いカウンター</b></td>
<td><b>詳細</b></td>
</tr>
${championRows}
</table>`;
  }
  
  /**
   * 完全カウンターテーブル生成（詳細ページ用）
   */
  generateFullCounterTable(championData) {
    const counters = championData.counterRelationships || {};
    const strongCounters = counters.strongCounters || [];
    const regularCounters = counters.counters || [];
    const counteredBy = counters.counteredBy || [];
    
    let tableHtml = `<table width="100%" border="1">
<tr bgcolor="#e8f5e8">
<td colspan="6"><h3>🛡️ 強力なカウンター（勝率65%以上）</h3></td>
</tr>
<tr bgcolor="#f0f0f0">
<td><b>相手</b></td><td><b>レーン</b></td><td><b>勝率</b></td><td><b>試合数</b></td><td><b>信頼度</b></td><td><b>強度</b></td>
</tr>`;
    
    if (strongCounters.length > 0) {
      strongCounters.forEach(counter => {
        tableHtml += `<tr>
<td><a href="${counter.championId.toLowerCase()}.html">${counter.championName}</a></td>
<td>${counter.lane}</td>
<td>${(counter.matchupWinRate * 100).toFixed(1)}%</td>
<td>${counter.sampleSize}</td>
<td>${(counter.significance * 100).toFixed(1)}%</td>
<td>${counter.counterStrength}</td>
</tr>`;
      });
    } else {
      tableHtml += `<tr><td colspan="6" align="center">データ収集中...</td></tr>`;
    }
    
    tableHtml += `</table>\n\n<table width="100%" border="1">
<tr bgcolor="#ffe8e8">
<td colspan="6"><h3>⚠️ 苦手な相手（勝率45%以下）</h3></td>
</tr>
<tr bgcolor="#f0f0f0">
<td><b>相手</b></td><td><b>レーン</b></td><td><b>相手勝率</b></td><td><b>試合数</b></td><td><b>信頼度</b></td><td><b>危険度</b></td>
</tr>`;
    
    if (counteredBy.length > 0) {
      counteredBy.forEach(counter => {
        tableHtml += `<tr>
<td><a href="${counter.championId.toLowerCase()}.html">${counter.championName}</a></td>
<td>${counter.lane}</td>
<td>${(counter.enemyWinRate * 100).toFixed(1)}%</td>
<td>${counter.sampleSize}</td>
<td>${(counter.significance * 100).toFixed(1)}%</td>
<td>${counter.counterStrength}</td>
</tr>`;
      });
    } else {
      tableHtml += `<tr><td colspan="6" align="center">データ収集中...</td></tr>`;
    }
    
    tableHtml += `</table>`;
    return tableHtml;
  }
  
  /**
   * 全体統計テーブル生成
   */
  generateOverallStatsTable(championData) {
    const stats = championData.overallStats || {};
    const winRate = ((stats.winRate || 0.5) * 100).toFixed(1);
    const totalGames = stats.totalGames || 0;
    const reliability = stats.isReliable ? '高' : '低';
    
    return `<table width="100%" border="1">
<tr bgcolor="#e3f2fd">
<td colspan="4"><h3>📊 全体統計</h3></td>
</tr>
<tr bgcolor="#f0f0f0">
<td><b>全体勝率</b></td><td><b>総試合数</b></td><td><b>データ信頼性</b></td><td><b>ティア</b></td>
</tr>
<tr>
<td>${winRate}%</td>
<td>${totalGames.toLocaleString()}</td>
<td>${reliability}</td>
<td>A</td>
</tr>
</table>`;
  }
  
  /**
   * レーンパフォーマンステーブル生成
   */
  generateLanePerformanceTable(championData) {
    const lanePerf = championData.lanePerformance || {};
    
    if (Object.keys(lanePerf).length === 0) {
      return `<table width="100%" border="1">
<tr><td>レーン別データ収集中...</td></tr>
</table>`;
    }
    
    let tableHtml = `<table width="100%" border="1">
<tr bgcolor="#fff3e0">
<td colspan="4"><h3>🎯 レーン別パフォーマンス</h3></td>
</tr>
<tr bgcolor="#f0f0f0">
<td><b>レーン</b></td><td><b>勝率</b></td><td><b>採用率</b></td><td><b>試合数</b></td>
</tr>`;
    
    Object.entries(lanePerf).forEach(([lane, data]) => {
      const laneNameJP = this.getLaneNameJP(lane);
      const winRate = ((data.winRate || 0) * 100).toFixed(1);
      const playRate = ((data.playRate || 0) * 100).toFixed(1);
      const games = data.games || 0;
      
      tableHtml += `<tr>
<td>${laneNameJP}</td>
<td>${winRate}%</td>
<td>${playRate}%</td>
<td>${games}</td>
</tr>`;
    });
    
    tableHtml += `</table>`;
    return tableHtml;
  }

  /**
   * チャンピオン一覧行生成（軽量版）
   */
  generateChampionListingRow(champion) {
    const championName = champion.name || champion.id;
    const championId = champion.id || championName.toLowerCase();
    const stats = champion.overallStats || champion.stats || {};
    const winRate = ((stats.winRate || 0.5) * 100).toFixed(1);
    
    // 強力なカウンター（最大3つ）
    const counters = champion.counterRelationships?.strongCounters || champion.stats?.counterData?.strongAgainst || [];
    const topCounters = counters.slice(0, 3).map(counter => {
      if (typeof counter === 'string') {
        return counter;
      }
      return counter.championName || counter;
    }).join(', ') || '算出中';
    
    return `<tr>
<td><b>${championName}</b></td>
<td>${winRate}%</td>
<td>${topCounters}</td>
<td><a href="${championId.toLowerCase()}.html">詳細</a></td>
</tr>`;
  }
  
  /**
   * チャンピオンヘッダー生成（詳細ページ用）
   */
  generateChampionHeader(championData, metadata) {
    const championName = championData.name || championData.id;
    const lastUpdate = metadata.fetchTime ? 
      new Date(metadata.fetchTime).toLocaleString('ja-JP') : '不明';
    
    return `<table width="100%" border="0">
<tr>
<td align="center">
<h1>⚡ ${championName} カウンター情報</h1>
<p><b>最終更新: ${lastUpdate}</b></p>
<p><a href="index.html">← 一覧に戻る</a></p>
</td>
</tr>
</table>`;
  }
  
  /**
   * 詳細ページナビゲーション生成
   */
  generateDetailNavigation(championData, allChampions) {
    return `<table width="100%" border="1">
<tr>
<td><a href="index.html">トップ</a></td>
<td><a href="a-z.html">A-Z順</a></td>
<td><a href="category-assassin.html">アサシン</a></td>
<td><a href="category-fighter.html">ファイター</a></td>
<td><a href="category-mage.html">メイジ</a></td>
</tr>
</table>`;
  }
  
  /**
   * 検索ナビゲーション生成
   */
  generateSearchNavigation(searchKey) {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const letterLinks = letters.map(letter => 
      `<a href="search-${letter}.html">${letter.toUpperCase()}</a>`
    ).join(' | ');
    
    return `<table width="100%" border="1">
<tr>
<td align="center">
<p><b>文字検索:</b> ${letterLinks}</p>
<p><a href="index.html">← トップに戻る</a></p>
</td>
</tr>
</table>`;
  }
  
  /**
   * 検索ヘッダー生成
   */
  generateSearchHeader(searchTitle, count) {
    return `<table width="100%" border="0">
<tr>
<td align="center">
<h1>🔍 ${searchTitle}</h1>
<p><b>該当チャンピオン数: ${count}</b></p>
</td>
</tr>
</table>`;
  }
  
  /**
   * レーンナビゲーション生成
   */
  generateLaneNavigation(currentLane) {
    const lanes = ['TOP', 'MIDDLE', 'BOTTOM', 'JUNGLE', 'UTILITY'];
    const laneLinks = lanes.map(lane => {
      const laneNameJP = this.getLaneNameJP(lane);
      const href = `lane-${lane.toLowerCase()}.html`;
      const style = lane === currentLane ? ' bgcolor="#e3f2fd"' : '';
      return `<td${style}><a href="${href}">${laneNameJP}</a></td>`;
    }).join('\n');
    
    return `<table width="100%" border="1">
<tr>
${laneLinks}
</tr>
</table>`;
  }
  
  /**
   * レーンヘッダー生成
   */
  generateLaneHeader(laneNameJP, count) {
    return `<table width="100%" border="0">
<tr>
<td align="center">
<h1>🎯 ${laneNameJP}レーン チャンピオン</h1>
<p><b>チャンピオン数: ${count}</b></p>
</td>
</tr>
</table>`;
  }
  
  /**
   * レーンチャンピオンテーブル生成
   */
  generateLaneChampionTable(champions, lane) {
    const championRows = champions.map(champion => {
      const laneData = champion.lanePerformance?.[lane] || {};
      const winRate = ((laneData.winRate || 0) * 100).toFixed(1);
      const games = laneData.games || 0;
      const championName = champion.name || champion.id;
      const championId = champion.id || championName.toLowerCase();
      
      return `<tr>
<td><a href="${championId.toLowerCase()}.html">${championName}</a></td>
<td>${winRate}%</td>
<td>${games}</td>
</tr>`;
    }).join('\n');
    
    return `<table width="100%" border="1">
<tr bgcolor="#f0f0f0">
<td><b>チャンピオン</b></td>
<td><b>勝率</b></td>
<td><b>試合数</b></td>
</tr>
${championRows}
</table>`;
  }
  
  /**
   * レーン名日本語変換
   */
  getLaneNameJP(lane) {
    const laneNames = {
      'TOP': 'トップ',
      'MIDDLE': 'ミッド',
      'BOTTOM': 'ボット',
      'JUNGLE': 'ジャングル',
      'UTILITY': 'サポート'
    };
    return laneNames[lane] || lane;
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
   * Service Worker登録スクリプト生成（最小限）
   */
  generateServiceWorkerScript() {
    return `<script>
if('serviceWorker' in navigator){
navigator.serviceWorker.register('sw.js');
}
</script>`;
  }

  /**
   * PWA対応ファイル生成
   */
  async generatePWAFiles() {
    // PWA Manifest生成
    await this.generateManifest();
    
    // Service Worker生成
    await this.generateServiceWorker();
    
    this.log('debug', 'PWA files generated');
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
  }
  
  /**
   * Service Worker生成
   */
  async generateServiceWorker() {
    const swContent = `// FastestLOLCounterFinder Service Worker
// Generated: ${new Date().toISOString()}

const CACHE_NAME = 'lol-counter-v${Date.now()}';
const urlsToCache = [
  '/',
  '/index.html',
  '/a-z.html',
  '/z-a.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});`;

    const swPath = join(this.outputDir, 'sw.js');
    await fs.writeFile(swPath, swContent, 'utf8');
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