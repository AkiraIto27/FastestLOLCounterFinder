/**
 * Riot Games API クライアント
 * レート制限、エラーハンドリング、データ統合処理を含む
 */

import fetch from 'node-fetch';

export class ApiClient {
  constructor(config) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.targetRegion = config.targetRegion;
    this.accountRegion = config.accountRegion;
    this.callCount = 0;
    this.rateLimitTracker = {
      requests: [],
      lastReset: Date.now()
    };
    
    // API エンドポイント定義
    this.endpoints = {
      // Platform Data
      platformData: `https://${this.targetRegion}.api.riotgames.com/lol/status/v4/platform-data`,
      
      // Champion APIs
      championRotations: `https://${this.targetRegion}.api.riotgames.com/lol/champion/v3/champion-rotations`,
      
      // Data Dragon (Static Data)
      ddragonVersions: 'https://ddragon.leagueoflegends.com/api/versions.json',
      
      // Account API (リージョン別)
      accountByRiotId: (gameName, tagLine) => 
        `https://${this.accountRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      
      // Summoner API
      summonerByPuuid: (puuid) => 
        `https://${this.targetRegion}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      
      // League API
      leagueByPuuid: (puuid) => 
        `https://${this.targetRegion}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
      
      // Match API (リージョン別)
      matchIdsByPuuid: (puuid) => 
        `https://${this.accountRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      
      matchById: (matchId) => 
        `https://${this.accountRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}`
    };
  }

  /**
   * レート制限チェック
   */
  async checkRateLimit() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const twoMinutesAgo = now - (2 * 60 * 1000);
    
    // 過去の記録をクリーンアップ
    this.rateLimitTracker.requests = this.rateLimitTracker.requests.filter(
      timestamp => timestamp > twoMinutesAgo
    );
    
    const recentRequests = this.rateLimitTracker.requests.filter(
      timestamp => timestamp > oneSecondAgo
    ).length;
    
    const totalRequests = this.rateLimitTracker.requests.length;
    
    // レート制限チェック（個人用APIキー: 20req/sec, 100req/2min）
    if (recentRequests >= 20) {
      const waitTime = 1100; // 1.1秒待機
      this.log('warn', `Rate limit approaching, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }
    
    if (totalRequests >= 100) {
      const waitTime = 120000; // 2分待機
      this.log('warn', `2-minute rate limit reached, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
      this.rateLimitTracker.requests = [];
    }
  }

  /**
   * APIリクエスト実行
   */
  async makeRequest(url, options = {}) {
    await this.checkRateLimit();
    
    try {
      this.log('debug', `Making request to: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'X-Riot-Token': this.apiKey,
          'User-Agent': 'FastestLOLCounterFinder/1.0.0',
          ...options.headers
        },
        ...options
      });
      
      // リクエスト記録
      this.rateLimitTracker.requests.push(Date.now());
      this.callCount++;
      
      // レスポンスヘッダーの確認
      this.logRateLimitHeaders(response);
      
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1') * 1000;
        this.log('warn', `Rate limited, retrying after ${retryAfter}ms`);
        await this.sleep(retryAfter);
        return this.makeRequest(url, options); // リトライ
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      this.log('debug', `Request successful: ${url}`);
      
      return data;
      
    } catch (error) {
      this.log('error', `Request failed: ${url}`, error.message);
      throw error;
    }
  }

  /**
   * Data Dragon APIリクエスト（レート制限なし）
   */
  async makeDdragonRequest(url) {
    try {
      this.log('debug', `Making Data Dragon request: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      this.log('error', `Data Dragon request failed: ${url}`, error.message);
      throw error;
    }
  }

  /**
   * 全データ取得メイン処理
   */
  async fetchAllData() {
    this.log('info', 'Starting comprehensive data fetch');
    
    const gameData = {
      metadata: {
        fetchTime: new Date().toISOString(),
        version: null,
        region: this.targetRegion
      },
      champions: {},
      championStats: {},
      matchData: [],
      errors: []
    };
    
    try {
      // Step 1: 最新バージョン取得
      gameData.metadata.version = await this.getLatestVersion();
      this.log('info', `Latest version: ${gameData.metadata.version}`);
      
      // Step 2: チャンピオンデータ取得
      gameData.champions = await this.getChampionData(gameData.metadata.version);
      this.log('info', `Fetched ${Object.keys(gameData.champions).length} champions`);
      
      // Step 3: チャンピオンローテーション取得
      gameData.championRotations = await this.getChampionRotations();
      
      // Step 4: ランク高プレイヤーのデータ取得（サンプル）
      const sampleMatches = await this.getSampleMatchData();
      gameData.matchData = sampleMatches;
      
      // Step 5: チャンピオン統計計算
      gameData.championStats = this.calculateChampionStats(gameData.matchData, gameData.champions);
      
      this.log('info', 'Data fetch completed successfully');
      return gameData;
      
    } catch (error) {
      gameData.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      });
      
      this.log('error', 'Error during data fetch:', error.message);
      return gameData;
    }
  }

  /**
   * 最新ゲームバージョン取得
   */
  async getLatestVersion() {
    const versions = await this.makeDdragonRequest(this.endpoints.ddragonVersions);
    return versions[0]; // 最新バージョン
  }

  /**
   * チャンピオンデータ取得
   */
  async getChampionData(version) {
    const championUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/champion.json`;
    const championData = await this.makeDdragonRequest(championUrl);
    
    // 詳細データも取得
    const detailedChampions = {};
    const championKeys = Object.keys(championData.data);
    
    // バッチ処理でレート制限を考慮
    for (let i = 0; i < championKeys.length; i += 5) {
      const batch = championKeys.slice(i, i + 5);
      
      const batchPromises = batch.map(async (championKey) => {
        try {
          const detailUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/champion/${championKey}.json`;
          const detailData = await this.makeDdragonRequest(detailUrl);
          return { [championKey]: detailData.data[championKey] };
        } catch (error) {
          this.log('warn', `Failed to fetch details for ${championKey}:`, error.message);
          return { [championKey]: championData.data[championKey] };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => Object.assign(detailedChampions, result));
      
      // バッチ間で少し待機
      if (i + 5 < championKeys.length) {
        await this.sleep(100);
      }
    }
    
    return detailedChampions;
  }

  /**
   * チャンピオンローテーション取得
   */
  async getChampionRotations() {
    try {
      return await this.makeRequest(this.endpoints.championRotations);
    } catch (error) {
      this.log('warn', 'Failed to fetch champion rotations:', error.message);
      return { freeChampionIds: [], freeChampionIdsForNewPlayers: [] };
    }
  }

  /**
   * サンプルマッチデータ取得
   */
  async getSampleMatchData() {
    const samplePlayers = [
      { gameName: 'Faker', tagLine: 'T1' },
      { gameName: 'DWG Showmaker', tagLine: 'KR1' },
      { gameName: 'DRX Deft', tagLine: 'KR1' }
    ];
    
    const matchData = [];
    
    for (const player of samplePlayers) {
      try {
        // Account情報取得
        const account = await this.makeRequest(
          this.endpoints.accountByRiotId(player.gameName, player.tagLine)
        );
        
        if (account.puuid) {
          // 最近の試合ID取得（最大5試合）
          const matchIds = await this.makeRequest(
            `${this.endpoints.matchIdsByPuuid(account.puuid)}?count=5`
          );
          
          // 試合詳細取得
          for (const matchId of matchIds.slice(0, 2)) { // 最初の2試合のみ
            try {
              const matchDetail = await this.makeRequest(
                this.endpoints.matchById(matchId)
              );
              matchData.push(matchDetail);
              
              // API呼び出し間隔制御
              await this.sleep(200);
              
            } catch (error) {
              this.log('warn', `Failed to fetch match ${matchId}:`, error.message);
            }
          }
        }
        
        // プレイヤー間でのAPI呼び出し間隔制御
        await this.sleep(500);
        
      } catch (error) {
        this.log('warn', `Failed to fetch data for ${player.gameName}#${player.tagLine}:`, error.message);
      }
    }
    
    return matchData;
  }

  /**
   * チャンピオン統計計算
   */
  calculateChampionStats(matchData, champions) {
    const stats = {};
    
    // チャンピオン初期化
    Object.keys(champions).forEach(championKey => {
      stats[championKey] = {
        name: champions[championKey].name,
        id: champions[championKey].id,
        key: champions[championKey].key,
        totalGames: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        averageKDA: { kills: 0, deaths: 0, assists: 0 },
        tags: champions[championKey].tags || [],
        counters: [],
        strongAgainst: []
      };
    });
    
    // マッチデータから統計計算
    matchData.forEach(match => {
      if (match.info && match.info.participants) {
        match.info.participants.forEach(participant => {
          const championName = participant.championName;
          if (stats[championName]) {
            stats[championName].totalGames++;
            if (participant.win) {
              stats[championName].wins++;
            } else {
              stats[championName].losses++;
            }
            
            // KDA累積
            stats[championName].averageKDA.kills += participant.kills || 0;
            stats[championName].averageKDA.deaths += participant.deaths || 0;
            stats[championName].averageKDA.assists += participant.assists || 0;
          }
        });
      }
    });
    
    // 勝率とKDA平均計算
    Object.keys(stats).forEach(championKey => {
      const champion = stats[championKey];
      if (champion.totalGames > 0) {
        champion.winRate = (champion.wins / champion.totalGames * 100).toFixed(1);
        champion.averageKDA.kills = (champion.averageKDA.kills / champion.totalGames).toFixed(1);
        champion.averageKDA.deaths = (champion.averageKDA.deaths / champion.totalGames).toFixed(1);
        champion.averageKDA.assists = (champion.averageKDA.assists / champion.totalGames).toFixed(1);
      }
    });
    
    return stats;
  }

  /**
   * レート制限ヘッダーログ出力
   */
  logRateLimitHeaders(response) {
    if (this.config.debug) {
      const headers = {
        appRateLimit: response.headers.get('X-App-Rate-Limit'),
        appRateLimitCount: response.headers.get('X-App-Rate-Limit-Count'),
        methodRateLimit: response.headers.get('X-Method-Rate-Limit'),
        methodRateLimitCount: response.headers.get('X-Method-Rate-Limit-Count')
      };
      
      if (Object.values(headers).some(h => h !== null)) {
        this.log('debug', 'Rate limit headers:', headers);
      }
    }
  }

  /**
   * 呼び出し回数取得
   */
  getCallCount() {
    return this.callCount;
  }

  /**
   * 待機処理
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ログ出力
   */
  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [API-CLIENT] [${level.toUpperCase()}]`;
    
    if (level === 'debug' && !this.config.debug) return;
    
    console.log(prefix, message, ...args);
  }
}