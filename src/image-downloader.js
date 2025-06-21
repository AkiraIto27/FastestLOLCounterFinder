/**
 * 画像ダウンローダー
 * チャンピオン画像をローカルに保存し、HTMLで参照するパスマッピングを提供
 */

import fetch from 'node-fetch';
import fs from 'fs-extra';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export class ImageDownloader {
  constructor(config) {
    this.config = config;
    this.outputDir = join(process.cwd(), config.outputDir, 'images');
    this.downloadedImages = new Map();
    this.errors = [];
    
    // 画像タイプ定義
    this.imageTypes = {
      champion: {
        square: (version, championId) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`,
        loading: (version, championId) => `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${championId}_0.jpg`,
        splash: (version, championId) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_0.jpg`,
        passive: (version, imageName) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${imageName}`,
        spell: (version, imageName) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${imageName}`
      },
      item: (version, itemId) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`,
      summoner: (version, summonerSpell) => `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${summonerSpell}.png`
    };
  }

  /**
   * 画像ディレクトリ初期化
   */
  async initializeDirectories() {
    const directories = [
      this.outputDir,
      join(this.outputDir, 'champion'),
      join(this.outputDir, 'champion', 'square'),
      join(this.outputDir, 'champion', 'loading'),
      join(this.outputDir, 'champion', 'splash'),
      join(this.outputDir, 'champion', 'passive'),
      join(this.outputDir, 'champion', 'spell'),
      join(this.outputDir, 'item'),
      join(this.outputDir, 'summoner')
    ];

    for (const dir of directories) {
      await fs.ensureDir(dir);
    }

    this.log('info', 'Image directories initialized');
  }

  /**
   * 全画像ダウンロード
   */
  async downloadImages(gameData) {
    this.log('info', 'Starting image download process');
    
    await this.initializeDirectories();
    
    const imageMap = {
      champions: {},
      items: {},
      summoners: {}
    };

    try {
      // チャンピオン画像ダウンロード
      if (gameData.champions) {
        imageMap.champions = await this.downloadChampionImages(gameData.champions, gameData.metadata.version);
      }

      // アイテム画像ダウンロード（必要に応じて）
      // imageMap.items = await this.downloadItemImages(gameData.items, gameData.metadata.version);

      // サモナースペル画像ダウンロード（必要に応じて）
      // imageMap.summoners = await this.downloadSummonerImages(gameData.summoners, gameData.metadata.version);

      this.log('info', `Image download completed. Downloaded ${this.downloadedImages.size} images`);
      
      if (this.errors.length > 0) {
        this.log('warn', `${this.errors.length} errors occurred during download`);
      }

      return imageMap;

    } catch (error) {
      this.log('error', 'Image download process failed:', error.message);
      throw error;
    }
  }

  /**
   * チャンピオン画像ダウンロード
   */
  async downloadChampionImages(champions, version) {
    this.log('info', `Downloading champion images for ${Object.keys(champions).length} champions`);
    
    const championImageMap = {};
    const championKeys = Object.keys(champions);

    // バッチ処理（同時実行数制限）
    const batchSize = 5;
    for (let i = 0; i < championKeys.length; i += batchSize) {
      const batch = championKeys.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (championKey) => {
        const champion = champions[championKey];
        const championImages = await this.downloadChampionImageSet(champion, version);
        championImageMap[championKey] = championImages;
      });

      await Promise.all(batchPromises);
      
      // バッチ間の待機（サーバー負荷軽減）
      if (i + batchSize < championKeys.length) {
        await this.sleep(100);
      }
    }

    return championImageMap;
  }

  /**
   * 個別チャンピオンの画像セットダウンロード
   */
  async downloadChampionImageSet(champion, version) {
    const championId = champion.id;
    const images = {
      square: null,
      loading: null,
      splash: null,
      passive: null,
      spells: []
    };

    try {
      // チャンピオン正方形画像（必須）
      images.square = await this.downloadSingleImage(
        this.imageTypes.champion.square(version, championId),
        join('champion', 'square', `${championId}.png`),
        `champion-square-${championId}`
      );

      // チャンピオンローディング画像（推奨）
      images.loading = await this.downloadSingleImage(
        this.imageTypes.champion.loading(version, championId),
        join('champion', 'loading', `${championId}_0.jpg`),
        `champion-loading-${championId}`
      );

      // チャンピオンスプラッシュ画像（オプション）
      if (!this.config.isDev) { // 開発時はスキップ（サイズが大きいため）
        images.splash = await this.downloadSingleImage(
          this.imageTypes.champion.splash(version, championId),
          join('champion', 'splash', `${championId}_0.jpg`),
          `champion-splash-${championId}`
        );
      }

      // パッシブスキル画像
      if (champion.passive && champion.passive.image) {
        images.passive = await this.downloadSingleImage(
          this.imageTypes.champion.passive(version, champion.passive.image.full),
          join('champion', 'passive', champion.passive.image.full),
          `champion-passive-${championId}`
        );
      }

      // アクティブスキル画像
      if (champion.spells && champion.spells.length > 0) {
        for (let i = 0; i < champion.spells.length; i++) {
          const spell = champion.spells[i];
          if (spell.image) {
            const spellImagePath = await this.downloadSingleImage(
              this.imageTypes.champion.spell(version, spell.image.full),
              join('champion', 'spell', spell.image.full),
              `champion-spell-${championId}-${i}`
            );
            images.spells.push(spellImagePath);
          }
        }
      }

    } catch (error) {
      this.log('error', `Failed to download images for champion ${championId}:`, error.message);
      this.errors.push({
        type: 'champion',
        championId,
        error: error.message
      });
    }

    return images;
  }

  /**
   * 単一画像ダウンロード
   */
  async downloadSingleImage(url, relativePath, imageKey) {
    const fullPath = join(this.outputDir, relativePath);
    
    // 既にダウンロード済みの場合はスキップ
    if (this.downloadedImages.has(imageKey)) {
      return this.downloadedImages.get(imageKey);
    }

    // ファイルが既に存在する場合はスキップ
    if (await fs.pathExists(fullPath)) {
      const webPath = `/images/${relativePath.replace(/\\/g, '/')}`;
      this.downloadedImages.set(imageKey, webPath);
      return webPath;
    }

    try {
      this.log('debug', `Downloading: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // ファイル保存
      await fs.ensureDir(join(fullPath, '..'));
      await pipeline(response.body, createWriteStream(fullPath));

      // 画像サイズチェック（破損ファイル検出）
      const stats = await fs.stat(fullPath);
      if (stats.size === 0) {
        await fs.unlink(fullPath);
        throw new Error('Downloaded file is empty');
      }

      const webPath = `/images/${relativePath.replace(/\\/g, '/')}`;
      this.downloadedImages.set(imageKey, webPath);
      
      this.log('debug', `Successfully downloaded: ${relativePath}`);
      return webPath;

    } catch (error) {
      this.log('warn', `Failed to download ${url}:`, error.message);
      this.errors.push({
        type: 'single_image',
        url,
        path: relativePath,
        error: error.message
      });
      
      return null;
    }
  }

  /**
   * 画像サイズ最適化（将来的な拡張）
   */
  async optimizeImage(imagePath) {
    // ここでImageMagickやSharpなどを使用した画像最適化を実装可能
    // 現在はプレースホルダー
    return imagePath;
  }

  /**
   * 画像の寸法取得
   */
  async getImageDimensions(imagePath) {
    try {
      // 簡易的な画像サイズ取得
      // 実際のプロジェクトではimage-sizeライブラリなどを使用
      const stats = await fs.stat(imagePath);
      
      // デフォルト値を返す（実際のサイズは別途取得が必要）
      return {
        width: 120,
        height: 120
      };
      
    } catch (error) {
      this.log('warn', `Failed to get image dimensions for ${imagePath}:`, error.message);
      return {
        width: 120,
        height: 120
      };
    }
  }

  /**
   * 未使用画像のクリーンアップ
   */
  async cleanupUnusedImages() {
    try {
      const existingFiles = await this.getAllImageFiles();
      const usedImages = new Set(this.downloadedImages.values());
      
      for (const file of existingFiles) {
        const webPath = file.replace(this.outputDir, '/images').replace(/\\/g, '/');
        if (!usedImages.has(webPath)) {
          await fs.unlink(file);
          this.log('debug', `Cleaned up unused image: ${file}`);
        }
      }
      
    } catch (error) {
      this.log('warn', 'Failed to cleanup unused images:', error.message);
    }
  }

  /**
   * 全画像ファイルの取得
   */
  async getAllImageFiles() {
    const files = [];
    
    async function scanDirectory(dir) {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (stats.isFile() && /\.(png|jpg|jpeg|gif|webp)$/i.test(item)) {
          files.push(fullPath);
        }
      }
    }
    
    if (await fs.pathExists(this.outputDir)) {
      await scanDirectory(this.outputDir);
    }
    
    return files;
  }

  /**
   * ダウンロード統計取得
   */
  getDownloadStats() {
    return {
      totalDownloaded: this.downloadedImages.size,
      errors: this.errors.length,
      errorDetails: this.errors
    };
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
    const prefix = `[${timestamp}] [IMAGE-DOWNLOADER] [${level.toUpperCase()}]`;
    
    if (level === 'debug' && !this.config.debug) return;
    
    console.log(prefix, message, ...args);
  }
}