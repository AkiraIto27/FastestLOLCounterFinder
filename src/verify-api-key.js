#!/usr/bin/env node

/**
 * Riot API Key検証スクリプト
 * APIキーの有効性とレート制限をテスト
 */

import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const PROJECT_ROOT = join(__dirname, '..');

// 環境変数読み込み
config({ path: join(PROJECT_ROOT, '.env') });

const API_KEY = process.env.RIOT_API_KEY;
const TARGET_REGION = process.env.TARGET_REGION || 'jp1';
const ACCOUNT_REGION = process.env.ACCOUNT_REGION || 'asia';

/**
 * ログ出力
 */
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };
  
  const color = colors[level] || colors.info;
  console.log(`${color}[${timestamp}] [${level.toUpperCase()}]${colors.reset}`, message, ...args);
}

/**
 * APIリクエスト実行
 */
async function makeApiRequest(url, description) {
  try {
    log('info', `Testing: ${description}`);
    log('info', `URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'X-Riot-Token': API_KEY,
        'User-Agent': 'FastestLOLCounterFinder/1.0.0'
      }
    });
    
    const headers = {
      status: response.status,
      statusText: response.statusText,
      rateLimitType: response.headers.get('X-Rate-Limit-Type'),
      rateLimitCount: response.headers.get('X-Rate-Limit-Count'),
      appRateLimit: response.headers.get('X-App-Rate-Limit'),
      appRateLimitCount: response.headers.get('X-App-Rate-Limit-Count'),
      methodRateLimit: response.headers.get('X-Method-Rate-Limit'),
      methodRateLimitCount: response.headers.get('X-Method-Rate-Limit-Count'),
      retryAfter: response.headers.get('Retry-After')
    };
    
    log('info', 'Response Headers:', headers);
    
    if (response.ok) {
      const data = await response.json();
      log('success', `✓ ${description} - Success`);
      return { success: true, data, headers };
    } else {
      const errorText = await response.text();
      log('error', `✗ ${description} - Failed: ${response.status} ${response.statusText}`);
      log('error', 'Error response:', errorText);
      return { success: false, error: errorText, headers };
    }
    
  } catch (error) {
    log('error', `✗ ${description} - Exception:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 基本APIテスト
 */
async function testBasicApis() {
  log('info', '=== Basic API Tests ===');
  
  const tests = [
    {
      url: `https://${TARGET_REGION}.api.riotgames.com/lol/status/v4/platform-data`,
      description: 'Platform Status API'
    },
    {
      url: `https://${TARGET_REGION}.api.riotgames.com/lol/champion/v3/champion-rotations`,
      description: 'Champion Rotations API'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await makeApiRequest(test.url, test.description);
    results.push({ ...test, ...result });
    
    // レート制限対応の待機
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * サマナー検索テスト
 */
async function testSummonerSearch() {
  log('info', '=== Summoner Search Test ===');
  
  // テスト用の著名なプレイヤー
  const testPlayers = [
    { gameName: 'Faker', tagLine: 'T1' },
    { gameName: 'Hide on bush', tagLine: 'KR1' }
  ];
  
  const results = [];
  
  for (const player of testPlayers) {
    try {
      // Account API でPUUIDを取得
      log('info', `Testing search for: ${player.gameName}#${player.tagLine}`);
      
      const accountUrl = `https://${ACCOUNT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(player.gameName)}/${encodeURIComponent(player.tagLine)}`;
      const accountResult = await makeApiRequest(accountUrl, 'Account API');
      
      if (accountResult.success && accountResult.data.puuid) {
        // Summoner API でサマナー情報を取得
        const summonerUrl = `https://${TARGET_REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountResult.data.puuid}`;
        const summonerResult = await makeApiRequest(summonerUrl, 'Summoner API');
        
        results.push({
          player,
          account: accountResult,
          summoner: summonerResult
        });
      } else {
        results.push({
          player,
          account: accountResult,
          summoner: { success: false, error: 'No PUUID found' }
        });
      }
      
      // レート制限対応
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      log('error', `Failed to test ${player.gameName}#${player.tagLine}:`, error.message);
      results.push({
        player,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * レート制限テスト
 */
async function testRateLimit() {
  log('info', '=== Rate Limit Test ===');
  log('warn', 'This test will make multiple rapid requests to test rate limiting');
  
  const testUrl = `https://${TARGET_REGION}.api.riotgames.com/lol/status/v4/platform-data`;
  const results = [];
  
  // 短時間で複数リクエストを送信
  for (let i = 1; i <= 5; i++) {
    log('info', `Rate limit test request ${i}/5`);
    const result = await makeApiRequest(testUrl, `Rate Limit Test ${i}`);
    results.push(result);
    
    if (result.headers?.retryAfter) {
      log('warn', `Rate limit hit! Retry-After: ${result.headers.retryAfter} seconds`);
      break;
    }
    
    // 短い間隔で送信
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  return results;
}

/**
 * 検証結果サマリー
 */
function printSummary(basicResults, summonerResults, rateLimitResults) {
  log('info', '=== API Key Verification Summary ===');
  
  const basicSuccess = basicResults.filter(r => r.success).length;
  const summonerSuccess = summonerResults.filter(r => r.account?.success && r.summoner?.success).length;
  
  log('info', `Basic API Tests: ${basicSuccess}/${basicResults.length} passed`);
  log('info', `Summoner Search Tests: ${summonerSuccess}/${summonerResults.length} passed`);
  
  if (basicSuccess > 0) {
    log('success', '✓ API Key is valid and working');
  } else {
    log('error', '✗ API Key validation failed');
  }
  
  // レート制限情報の表示
  const lastResult = basicResults[basicResults.length - 1];
  if (lastResult?.headers) {
    log('info', 'Current Rate Limit Status:');
    log('info', `  App Rate Limit: ${lastResult.headers.appRateLimit}`);
    log('info', `  App Rate Count: ${lastResult.headers.appRateLimitCount}`);
    log('info', `  Method Rate Limit: ${lastResult.headers.methodRateLimit}`);
    log('info', `  Method Rate Count: ${lastResult.headers.methodRateLimitCount}`);
  }
}

/**
 * メイン実行
 */
async function main() {
  try {
    log('info', '=== Riot API Key Verification Started ===');
    
    if (!API_KEY) {
      log('error', 'RIOT_API_KEY environment variable is not set');
      log('info', 'Please copy .env.example to .env and set your API key');
      process.exit(1);
    }
    
    log('info', `API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 8)}`);
    log('info', `Target Region: ${TARGET_REGION}`);
    log('info', `Account Region: ${ACCOUNT_REGION}`);
    
    const basicResults = await testBasicApis();
    const summonerResults = await testSummonerSearch();
    const rateLimitResults = await testRateLimit();
    
    printSummary(basicResults, summonerResults, rateLimitResults);
    
    log('info', '=== Verification Completed ===');
    
  } catch (error) {
    log('error', 'Verification failed:', error.message);
    process.exit(1);
  }
}

// 直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}