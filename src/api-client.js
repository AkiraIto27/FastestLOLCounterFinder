/**
 * Riot Games API クライアント - 完全カウンター情報生成システム
 * レート制限、統計計算、カウンター関係分析を含む
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
   * 全データ取得メイン処理 - 完全カウンター情報生成
   */
  async fetchAllData() {
    this.log('info', 'Starting comprehensive counter data generation');
    
    const gameData = {
      metadata: {
        fetchTime: new Date().toISOString(),
        version: null,
        region: this.targetRegion,
        patchVersion: null,
        totalMatches: 0,
        uniquePlayers: 0,
        dataQuality: {
          coverageByLane: {},
          averageSampleSize: 0,
          reliability: 'high'
        }
      },
      champions: {},
      championStats: {},
      matchData: [],
      highEloPlayers: [],
      rawMatchups: [],
      processedCounters: {},
      errors: []
    };
    
    try {
      // Phase 1: 基本データ取得
      gameData.metadata.version = await this.getLatestVersion();
      gameData.metadata.patchVersion = gameData.metadata.version;
      this.log('info', `Latest version: ${gameData.metadata.version}`);
      
      gameData.champions = await this.getChampionData(gameData.metadata.version);
      this.log('info', `Fetched ${Object.keys(gameData.champions).length} champions`);
      
      // Phase 2: 高ELOプレイヤーデータ収集
      if (this.config.isProd) {
        gameData.highEloPlayers = await this.getHighEloPlayers();
        this.log('info', `Found ${gameData.highEloPlayers.length} high ELO players`);
        
        // Phase 3: 試合履歴大量収集
        gameData.matchData = await this.collectRankedMatches(gameData.highEloPlayers);
        this.log('info', `Collected ${gameData.matchData.length} ranked matches`);
        
        // Phase 4: 対面データ処理
        gameData.rawMatchups = this.extractMatchupData(gameData.matchData);
        this.log('info', `Extracted ${gameData.rawMatchups.length} matchups`);
        
        // Phase 5: カウンター関係計算
        gameData.processedCounters = this.calculateCounterRelationships(gameData.rawMatchups, gameData.champions);
      } else {
        // 開発モード: サンプルデータ使用
        this.log('info', 'Development mode: using sample data');
        gameData.matchData = await this.getSampleMatchData();
        gameData.processedCounters = this.generateSampleCounters(gameData.champions);
      }
      
      // Phase 6: 最終統計計算
      gameData.championStats = this.calculateFinalStats(gameData.processedCounters, gameData.champions);
      gameData.metadata.totalMatches = gameData.matchData.length;
      gameData.metadata.uniquePlayers = new Set(gameData.matchData.map(m => m.info?.participants || []).flat().map(p => p.puuid)).size;
      
      this.log('info', 'Counter data generation completed successfully');
      return gameData;
      
    } catch (error) {
      gameData.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      });
      
      this.log('error', 'Error during data generation:', error.message);
      return gameData;
    }
  }

  /**
   * 最新ゲームバージョン取得
   */
  async getLatestVersion() {
    try {
      const versions = await this.makeDdragonRequest(this.endpoints.ddragonVersions);
      return versions[0]; // 最新バージョン
    } catch (error) {
      this.log('warn', 'Failed to fetch latest version, using fallback');
      return '15.12.1'; // フォールバック
    }
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
   * 高ELOプレイヤーリスト取得
   */
  async getHighEloPlayers() {
    const players = [];
    const queues = ['RANKED_SOLO_5x5'];
    
    try {
      for (const queue of queues) {
        // Challenger
        try {
          const challengerUrl = `https://${this.targetRegion}.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/${queue}`;
          const challengerData = await this.makeRequest(challengerUrl);
          
          // 上位100名に拡大
          const topChallengers = challengerData.entries
            .sort((a, b) => b.leaguePoints - a.leaguePoints)
            .slice(0, 100);
            
          for (const entry of topChallengers) {
            players.push({
              summonerId: entry.summonerId,
              tier: 'CHALLENGER',
              rank: entry.rank,
              leaguePoints: entry.leaguePoints,
              puuid: null // 後で取得
            });
          }
          
          this.log('info', `Found ${topChallengers.length} Challenger players`);
          await this.sleep(1100);
          
        } catch (error) {
          this.log('warn', 'Failed to fetch Challenger data:', error.message);
        }
        
        // Grandmaster
        try {
          const grandmasterUrl = `https://${this.targetRegion}.api.riotgames.com/lol/league/v4/grandmasterleagues/by-queue/${queue}`;
          const grandmasterData = await this.makeRequest(grandmasterUrl);
          
          // 上位60名に拡大
          const topGrandmasters = grandmasterData.entries
            .sort((a, b) => b.leaguePoints - a.leaguePoints)
            .slice(0, 60);
            
          for (const entry of topGrandmasters) {
            players.push({
              summonerId: entry.summonerId,
              tier: 'GRANDMASTER',
              rank: entry.rank,
              leaguePoints: entry.leaguePoints,
              puuid: null
            });
          }
          
          this.log('info', `Found ${topGrandmasters.length} Grandmaster players`);
          await this.sleep(1100);
          
        } catch (error) {
          this.log('warn', 'Failed to fetch Grandmaster data:', error.message);
        }
        
        // Master (上位40名に拡大)
        try {
          const masterUrl = `https://${this.targetRegion}.api.riotgames.com/lol/league/v4/masterleagues/by-queue/${queue}`;
          const masterData = await this.makeRequest(masterUrl);
          
          const topMasters = masterData.entries
            .sort((a, b) => b.leaguePoints - a.leaguePoints)
            .slice(0, 40);
            
          for (const entry of topMasters) {
            players.push({
              summonerId: entry.summonerId,
              tier: 'MASTER',
              rank: entry.rank,
              leaguePoints: entry.leaguePoints,
              puuid: null
            });
          }
          
          this.log('info', `Found ${topMasters.length} Master players`);
          await this.sleep(1100);
          
        } catch (error) {
          this.log('warn', 'Failed to fetch Master data:', error.message);
        }
      }
      
      // PUUID取得
      for (let i = 0; i < players.length; i++) {
        try {
          const summonerData = await this.makeRequest(
            `https://${this.targetRegion}.api.riotgames.com/lol/summoner/v4/summoners/${players[i].summonerId}`
          );
          players[i].puuid = summonerData.puuid;
          
          await this.sleep(55); // レート制限対応
          
        } catch (error) {
          this.log('warn', `Failed to get PUUID for summoner ${players[i].summonerId}:`, error.message);
        }
      }
      
      return players.filter(p => p.puuid);
      
    } catch (error) {
      this.log('error', 'Error fetching high ELO players:', error.message);
      return [];
    }
  }
  
  /**
   * 大量ランクマッチ収集
   */
  async collectRankedMatches(players) {
    const allMatches = [];
    const seenMatchIds = new Set();
    const targetMatches = Math.min(1000, players.length * 10); // 最大1000試合に拡大
    
    this.log('info', `Collecting up to ${targetMatches} ranked matches from ${players.length} players`);
    
    for (const player of players) {
      if (allMatches.length >= targetMatches) break;
      
      try {
        // 最近のランクマッチID取得（40試合に拡大）
        const matchIdsUrl = `${this.endpoints.matchIdsByPuuid(player.puuid)}?queue=420&count=40`; // RANKED_SOLO_5x5
        const matchIds = await this.makeRequest(matchIdsUrl);
        
        // 各マッチの詳細取得
        for (const matchId of matchIds) {
          if (allMatches.length >= targetMatches) break;
          if (seenMatchIds.has(matchId)) continue;
          
          try {
            const matchDetail = await this.makeRequest(
              this.endpoints.matchById(matchId)
            );
            
            // フィルタリング: 有効な試合のみ
            if (this.isValidMatch(matchDetail)) {
              allMatches.push(matchDetail);
              seenMatchIds.add(matchId);
            }
            
            await this.sleep(55); // レート制限対応
            
          } catch (error) {
            this.log('warn', `Failed to fetch match ${matchId}:`, error.message);
          }
        }
        
        await this.sleep(55);
        
      } catch (error) {
        this.log('warn', `Failed to fetch matches for player ${player.summonerId}:`, error.message);
      }
    }
    
    this.log('info', `Collected ${allMatches.length} valid matches`);
    return allMatches;
  }
  
  /**
   * 試合有効性チェック
   */
  isValidMatch(match) {
    if (!match.info) return false;
    
    const { gameDuration, gameMode, queueId } = match.info;
    
    // 条件チェック
    return (
      queueId === 420 && // ランクソロ
      gameMode === 'CLASSIC' &&
      gameDuration >= 900 && // 15分以上
      gameDuration <= 3600 && // 60分以下
      match.info.participants?.length === 10 // 10人フル参加
    );
  }
  
  /**
   * サンプルマッチデータ取得（開発用）
   */
  async getSampleMatchData() {
    // 開発用の軽量サンプルデータ
    return [
      {
        metadata: { matchId: 'SAMPLE_1' },
        info: {
          gameMode: 'CLASSIC',
          queueId: 420,
          gameDuration: 1800,
          participants: [
            { championId: 266, championName: 'Aatrox', teamPosition: 'TOP', teamId: 100, win: true },
            { championId: 103, championName: 'Ahri', teamPosition: 'MIDDLE', teamId: 100, win: true },
            // ... 他8名のサンプル
          ]
        }
      }
    ];
  }

  /**
   * 対面データ抽出
   */
  extractMatchupData(matchData) {
    const matchups = [];
    
    matchData.forEach(match => {
      if (!match.info?.participants) return;
      
      // レーン別グルーピング
      const laneGroups = {
        TOP: [],
        MIDDLE: [],
        BOTTOM: [],
        UTILITY: [],
        JUNGLE: []
      };
      
      match.info.participants.forEach(participant => {
        const lane = this.determineLane(participant);
        if (lane) {
          laneGroups[lane].push(participant);
        }
      });
      
      // 各レーンの対面を抽出
      Object.entries(laneGroups).forEach(([lane, participants]) => {
        if (participants.length === 2) { // 正常な1vs1
          const [p1, p2] = participants;
          
          matchups.push({
            matchId: match.metadata.matchId,
            lane: lane,
            champion1: {
              id: p1.championId,
              name: p1.championName,
              win: p1.win,
              teamId: p1.teamId
            },
            champion2: {
              id: p2.championId,
              name: p2.championName,
              win: p2.win,
              teamId: p2.teamId
            }
          });
        }
      });
    });
    
    return matchups;
  }
  
  /**
   * レーン判定（複数指標による総合判定）
   */
  determineLane(participant) {
    const position = participant.teamPosition;
    const role = participant.role;
    
    // APIの値を優先するが、不正確な場合の補正
    if (position && ['TOP', 'MIDDLE', 'BOTTOM', 'UTILITY', 'JUNGLE'].includes(position)) {
      return position;
    }
    
    // フォールバック: ロールベース
    const roleMapping = {
      'SOLO': 'TOP',
      'DUO': 'MIDDLE', 
      'DUO_CARRY': 'BOTTOM',
      'DUO_SUPPORT': 'UTILITY',
      'NONE': 'JUNGLE'
    };
    
    return roleMapping[role] || null;
  }
  
  /**
   * カウンター関係計算システム
   */
  calculateCounterRelationships(matchups, champions) {
    const matchupStats = new Map();
    const championStats = {};
    
    // 初期化
    Object.keys(champions).forEach(champKey => {
      const champion = champions[champKey];
      championStats[champion.id] = {
        id: champion.id,
        name: champion.name,
        key: champion.key,
        overallStats: {
          totalGames: 0,
          wins: 0,
          winRate: 0.5,
          isReliable: false
        },
        counterRelationships: {
          strongCounters: [],
          counters: [],
          counteredBy: []
        },
        lanePerformance: {}
      };
    });
    
    // 対面統計集計
    matchups.forEach(matchup => {
      const key1 = `${matchup.champion1.id}_vs_${matchup.champion2.id}_${matchup.lane}`;
      const key2 = `${matchup.champion2.id}_vs_${matchup.champion1.id}_${matchup.lane}`;
      
      this.updateMatchupStat(matchupStats, key1, matchup.champion1.win);
      this.updateMatchupStat(matchupStats, key2, matchup.champion2.win);
      
      // 全体統計更新
      this.updateOverallStats(championStats, matchup.champion1.id, matchup.champion1.win);
      this.updateOverallStats(championStats, matchup.champion2.id, matchup.champion2.win);
    });
    
    // カウンター関係判定
    this.processCounterRelationships(matchupStats, championStats);
    
    return championStats;
  }
  
  /**
   * 対面統計更新
   */
  updateMatchupStat(statsMap, key, isWin) {
    if (!statsMap.has(key)) {
      statsMap.set(key, { wins: 0, total: 0 });
    }
    
    const stat = statsMap.get(key);
    stat.total++;
    if (isWin) stat.wins++;
  }
  
  /**
   * 全体統計更新
   */
  updateOverallStats(championStats, championId, isWin) {
    if (championStats[championId]) {
      championStats[championId].overallStats.totalGames++;
      if (isWin) {
        championStats[championId].overallStats.wins++;
      }
    }
  }
  
  /**
   * カウンター関係処理
   */
  processCounterRelationships(matchupStats, championStats) {
    const MIN_SAMPLE_SIZE = 30;
    const STRONG_COUNTER_THRESHOLD = 0.65;
    const COUNTER_THRESHOLD = 0.56;
    
    matchupStats.forEach((stat, key) => {
      if (stat.total < MIN_SAMPLE_SIZE) return;
      
      const parts = key.split('_vs_');
      const championId = parts[0];
      const remainingParts = parts[1].split('_');
      const vsChampionId = remainingParts[0];
      const lane = remainingParts[1];
      const winRate = stat.wins / stat.total;
      
      const significance = this.calculateStatisticalSignificance(winRate, stat.total);
      
      if (!significance.isSignificant) return;
      
      const counterData = {
        championId: vsChampionId,
        championName: championStats[vsChampionId]?.name || 'Unknown',
        lane: lane,
        matchupWinRate: winRate,
        sampleSize: stat.total,
        significance: significance.pValue,
        counterStrength: this.classifyCounterStrength(winRate, stat.total, significance)
      };
      
      if (winRate >= STRONG_COUNTER_THRESHOLD) {
        championStats[championId]?.counterRelationships.strongCounters.push(counterData);
      } else if (winRate >= COUNTER_THRESHOLD) {
        championStats[championId]?.counterRelationships.counters.push(counterData);
      }
      
      // 逆の関係も記録
      if (winRate <= (1 - COUNTER_THRESHOLD)) {
        const reverseCounterData = {
          ...counterData,
          championId: championId,
          championName: championStats[championId]?.name || 'Unknown',
          enemyWinRate: winRate,
          matchupWinRate: 1 - winRate
        };
        championStats[vsChampionId]?.counterRelationships.counteredBy.push(reverseCounterData);
      }
    });
    
    // 統計の最終計算
    Object.values(championStats).forEach(champion => {
      if (champion.overallStats.totalGames > 0) {
        champion.overallStats.winRate = champion.overallStats.wins / champion.overallStats.totalGames;
        champion.overallStats.isReliable = champion.overallStats.totalGames >= MIN_SAMPLE_SIZE;
      }
    });
  }
  
  /**
   * 統計的有意性計算
   */
  calculateStatisticalSignificance(winRate, sampleSize, baseWinRate = 0.5) {
    const standardError = Math.sqrt((baseWinRate * (1 - baseWinRate)) / sampleSize);
    const zScore = (winRate - baseWinRate) / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    
    return {
      isSignificant: pValue < 0.05,
      pValue: pValue,
      zScore: zScore
    };
  }
  
  /**
   * 正規累積分布関数（近似）
   */
  normalCDF(x) {
    return (1.0 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI))) / 2.0;
  }
  
  /**
   * カウンター強度分類
   */
  classifyCounterStrength(winRate, sampleSize, significance) {
    if (!significance.isSignificant || sampleSize < 30) {
      return 'INSUFFICIENT_DATA';
    }
    
    const winRateDiff = Math.abs(winRate - 0.5);
    
    if (winRateDiff >= 0.15) return 'HARD_COUNTER';
    if (winRateDiff >= 0.10) return 'STRONG_COUNTER';
    if (winRateDiff >= 0.06) return 'SOFT_COUNTER';
    
    return 'NEUTRAL';
  }
  
  /**
   * 最終統計計算
   */
  calculateFinalStats(processedCounters, champions) {
    return processedCounters;
  }
  
  /**
   * サンプルカウンターデータ生成（開発用）
   */
  generateSampleCounters(champions) {
    const sampleCounters = {};
    
    Object.keys(champions).forEach(champKey => {
      const champion = champions[champKey];
      sampleCounters[champion.id] = {
        id: champion.id,
        name: champion.name,
        key: champion.key,
        overallStats: {
          totalGames: 150,
          wins: 75,
          winRate: 0.5,
          isReliable: true
        },
        counterRelationships: {
          strongCounters: this.generateCounterData(champion).strongAgainst.slice(0, 2).map(name => ({
            championId: '1',
            championName: name,
            lane: 'MIDDLE',
            matchupWinRate: 0.67,
            sampleSize: 89,
            significance: 0.02,
            counterStrength: 'STRONG_COUNTER'
          })),
          counters: [],
          counteredBy: []
        },
        lanePerformance: {
          TOP: { winRate: 0.52, playRate: 0.8, games: 120 }
        }
      };
    });
    
    return sampleCounters;
  }

  /**
   * カウンターチャンピオンデータ生成（上位5名と下位5名）
   */
  generateCounterData(champion) {
    const counterMap = {
      // アサシン系カウンター
      'Assassin': ['Malphite', 'Rammus', 'Tahm Kench', 'Janna', 'Lulu'],
      // ファイター系カウンター  
      'Fighter': ['Vayne', 'Fiora', 'Jax', 'Gnar', 'Quinn'],
      // メイジ系カウンター
      'Mage': ['Kassadin', 'Yasuo', 'Katarina', 'Fizz', 'Zed'],
      // マークスマン系カウンター
      'Marksman': ['Hecarim', 'Zed', 'Talon', 'Nocturne', 'Rengar'],
      // サポート系カウンター
      'Support': ['Brand', 'Xerath', 'Vel\'Koz', 'Zyra', 'Pyke'],
      // タンク系カウンター
      'Tank': ['Vayne', 'Kog\'Maw', 'Kai\'Sa', 'Cassiopeia', 'Azir']
    };

    const championTags = champion.tags || [];
    let strongCounters = [];

    // 主要タグに基づいてカウンターを取得
    championTags.forEach(tag => {
      if (counterMap[tag]) {
        strongCounters = strongCounters.concat(counterMap[tag]);
      }
    });

    // 特定チャンピオンの個別カウンター
    const specificCounters = this.getSpecificCounters(champion.name);
    strongCounters = strongCounters.concat(specificCounters);

    // 重複除去と最大5個に制限
    const top5Strong = [...new Set(strongCounters)].slice(0, 5);
    
    // 弱いチャンピオンを生成（このチャンピオンが強いチャンピオン）
    const weakAgainst = this.generateWeakAgainstData(champion);
    const bottom5Weak = [...new Set(weakAgainst)].slice(0, 5);

    return {
      strongAgainst: top5Strong,
      weakAgainst: bottom5Weak
    };
  }

  /**
   * 弱いチャンピオンデータ生成（このチャンピオンが強いチャンピオン）
   */
  generateWeakAgainstData(champion) {
    const weakMap = {
      // このチャンピオンが弱いチャンピオンたち
      'Assassin': ['Darius', 'Garen', 'Nasus', 'Maokai', 'Ornn'],
      'Fighter': ['Azir', 'Xerath', 'Ziggs', 'Lux', 'Vel\'Koz'],
      'Mage': ['Yasuo', 'Zed', 'Talon', 'Katarina', 'Kassadin'],
      'Marksman': ['Malphite', 'Rammus', 'Hecarim', 'Zed', 'Talon'],
      'Support': ['Zed', 'Talon', 'Yasuo', 'Irelia', 'Camille'],
      'Tank': ['Vayne', 'Fiora', 'Camille', 'Darius', 'Jax']
    };

    const championTags = champion.tags || [];
    let weakAgainst = [];

    championTags.forEach(tag => {
      if (weakMap[tag]) {
        weakAgainst = weakAgainst.concat(weakMap[tag]);
      }
    });

    // 特定チャンピオンの個別弱点
    const specificWeak = this.getSpecificWeakAgainst(champion.name);
    weakAgainst = weakAgainst.concat(specificWeak);

    return [...new Set(weakAgainst)].slice(0, 5);
  }

  /**
   * 強いチャンピオンデータ生成
   */
  generateStrongAgainstData(champion) {
    const strongMap = {
      'Assassin': ['Mage', 'Marksman'],
      'Fighter': ['Tank', 'Assassin'],
      'Mage': ['Fighter', 'Tank'],
      'Marksman': ['Tank', 'Fighter'],
      'Support': ['Assassin'],
      'Tank': ['Assassin', 'Mage']
    };

    const championTags = champion.tags || [];
    let strongAgainst = [];

    championTags.forEach(tag => {
      if (strongMap[tag]) {
        strongAgainst = strongAgainst.concat(strongMap[tag]);
      }
    });

    return [...new Set(strongAgainst)].slice(0, 3);
  }

  /**
   * 特定チャンピオンの個別カウンター
   */
  getSpecificCounters(championName) {
    const specificCounters = {
      'Yasuo': ['Annie', 'Malphite', 'Rammus'],
      'Zed': ['Kayle', 'Malphite', 'Lissandra'],
      'Katarina': ['Diana', 'Kassadin', 'Galio'],
      'Akali': ['Diana', 'Galio', 'Malzahar'],
      'Fizz': ['Diana', 'Galio', 'Vladimir'],
      'Leblanc': ['Galio', 'Kassadin', 'Malzahar'],
      'Vayne': ['Hecarim', 'Malphite', 'Rammus'],
      'Jinx': ['Hecarim', 'Zed', 'Talon'],
      'Ashe': ['Hecarim', 'Zed', 'Nocturne'],
      'Darius': ['Vayne', 'Gnar', 'Kennen'],
      'Garen': ['Vayne', 'Darius', 'Fiora'],
      'Nasus': ['Vayne', 'Darius', 'Gnar']
    };

    return specificCounters[championName] || [];
  }

  /**
   * 特定チャンピオンの個別弱点
   */
  getSpecificWeakAgainst(championName) {
    const specificWeak = {
      'Yasuo': ['Syndra', 'Annie', 'Lissandra'],
      'Zed': ['Exhaust + ADC', 'Kayle', 'Zhonyas'],
      'Katarina': ['CC Heavy', 'Diana', 'Galio'],
      'Akali': ['Pink Ward', 'Galio', 'Kassadin'],
      'Fizz': ['Zhonya', 'Barrier', 'Distance'],
      'Leblanc': ['MR Items', 'Sustain', 'Waveclear'],
      'Vayne': ['Early Game', 'CC Chain', 'Burst'],
      'Jinx': ['Dive Comp', 'Assassins', 'Gap Close'],
      'Ashe': ['Mobility', 'Dive', 'Flanking'],
      'Darius': ['Kiting', 'Range', 'Mobility'],
      'Garen': ['Kiting', 'True Damage', 'Sustain'],
      'Nasus': ['Early Pressure', 'Kiting', 'Split']
    };

    return specificWeak[championName] || [];
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