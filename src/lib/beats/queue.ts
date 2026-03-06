// Processing Queue - Async beat extraction with progress tracking
// Uses IndexedDB for persistence and Service Worker for background processing

'use client';

import { ExtractedBeat } from './types';

// Queue item status
type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface QueueItem {
  id: string;
  type: 'extraction' | 'import' | 'connection';
  status: QueueStatus;
  data: {
    noteId?: string;
    text?: string;
    batchId?: string;
    beatIds?: string[];
  };
  result?: {
    beats?: ExtractedBeat[];
    connections?: Array<{ from: string; to: string; type: string }>;
    errors?: string[];
  };
  progress: number; // 0-100
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface QueueConfig {
  concurrentJobs: number;
  retryAttempts: number;
  onProgress?: (id: string, progress: number) => void;
  onComplete?: (id: string, result: QueueItem['result']) => void;
  onError?: (id: string, error: string) => void;
}

const DB_NAME = 'context-beats-queue';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

/**
 * Processing Queue for async beat extraction
 */
export class ProcessingQueue {
  private db: IDBDatabase | null = null;
  private config: QueueConfig;
  private processing: Set<string> = new Set();
  
  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      concurrentJobs: 3,
      retryAttempts: 2,
      ...config
    };
  }
  
  /**
   * Initialize the queue (opens IndexedDB)
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status');
          store.createIndex('createdAt', 'createdAt');
        }
      };
    });
  }
  
  /**
   * Add a job to the queue
   */
  async addJob(
    type: QueueItem['type'],
    data: QueueItem['data']
  ): Promise<string> {
    const id = crypto.randomUUID();
    
    const item: QueueItem = {
      id,
      type,
      status: 'pending',
      data,
      progress: 0,
      createdAt: new Date()
    };
    
    await this.saveItem(item);
    this.processQueue();
    
    return id;
  }
  
  /**
   * Get job status
   */
  async getJob(id: string): Promise<QueueItem | null> {
    return this.getItem(id);
  }
  
  /**
   * Get all pending jobs
   */
  async getPendingJobs(): Promise<QueueItem[]> {
    return this.getItemsByStatus('pending');
  }
  
  /**
   * Get all jobs (for display)
   */
  async getAllJobs(): Promise<QueueItem[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Cancel a job
   */
  async cancelJob(id: string): Promise<void> {
    const item = await this.getItem(id);
    if (item && item.status === 'pending') {
      await this.deleteItem(id);
    }
  }
  
  /**
   * Retry a failed job
   */
  async retryJob(id: string): Promise<void> {
    const item = await this.getItem(id);
    if (item && item.status === 'failed') {
      item.status = 'pending';
      item.error = undefined;
      item.progress = 0;
      await this.saveItem(item);
      this.processQueue();
    }
  }
  
  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing.size >= this.config.concurrentJobs) {
      return;
    }
    
    const pending = await this.getPendingJobs();
    
    for (const item of pending) {
      if (this.processing.size >= this.config.concurrentJobs) {
        break;
      }
      
      this.processItem(item);
    }
  }
  
  /**
   * Process a single item
   */
  private async processItem(item: QueueItem): Promise<void> {
    this.processing.add(item.id);
    
    try {
      // Update status
      item.status = 'processing';
      item.startedAt = new Date();
      await this.saveItem(item);
      
      // Process based on type
      let result: QueueItem['result'];
      
      switch (item.type) {
        case 'extraction':
          result = await this.processExtraction(item);
          break;
        case 'import':
          result = await this.processImport(item);
          break;
        case 'connection':
          result = await this.processConnection(item);
          break;
        default:
          throw new Error(`Unknown job type: ${item.type}`);
      }
      
      // Mark complete
      item.status = 'completed';
      item.result = result;
      item.progress = 100;
      item.completedAt = new Date();
      await this.saveItem(item);
      
      this.config.onComplete?.(item.id, result);
      
    } catch (error) {
      // Mark failed
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      await this.saveItem(item);
      
      this.config.onError?.(item.id, item.error);
      
    } finally {
      this.processing.delete(item.id);
      this.processQueue();
    }
  }
  
  /**
   * Process extraction job
   */
  private async processExtraction(item: QueueItem): Promise<QueueItem['result']> {
    const { getBeatExtractor } = await import('./extractor');
    const extractor = getBeatExtractor();
    
    // Get text from note if noteId provided
    let text = item.data.text;
    
    if (item.data.noteId) {
      const response = await fetch(`/api/notes/${item.data.noteId}`);
      const data = await response.json();
      text = data.note?.contentPlain || data.note?.content;
    }
    
    if (!text) {
      throw new Error('No text to extract from');
    }
    
    // Update progress callback
    const beats = await extractor.extract(text, {
      onProgress: (progress) => {
        this.updateProgress(item.id, progress);
        this.config.onProgress?.(item.id, progress);
      }
    });
    
    // Create beats in database
    if (beats.length > 0 && item.data.noteId) {
      await fetch(`/api/notes/${item.data.noteId}/beats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beats, model: 'cloud' })
      });
    }
    
    return { beats };
  }
  
  /**
   * Process import job (batch processing)
   */
  private async processImport(item: QueueItem): Promise<QueueItem['result']> {
    // Import processing logic
    // This would handle chunking and batch extraction
    throw new Error('Import processing not implemented');
  }
  
  /**
   * Process connection job (analyze relationship)
   */
  private async processConnection(item: QueueItem): Promise<QueueItem['result']> {
    const { getBeatExtractor } = await import('./extractor');
    const extractor = getBeatExtractor();
    
    // Get beats to analyze
    const response = await fetch(`/api/beats?ids=${item.data.beatIds?.join(',')}`);
    const data = await response.json();
    
    const connections: Array<{ from: string; to: string; type: string }> = [];
    
    // Analyze pairs for connections
    for (let i = 0; i < data.beats.length; i++) {
      for (let j = i + 1; j < data.beats.length; j++) {
        const beat1 = data.beats[i];
        const beat2 = data.beats[j];
        
        const conn = await extractor.analyzeConnection(
          { type: beat1.beatType, name: beat1.name, summary: beat1.summary },
          { type: beat2.beatType, name: beat2.name, summary: beat2.summary }
        );
        
        if (conn && conn.strength > 0.7) {
          connections.push({
            from: beat1.id,
            to: beat2.id,
            type: conn.connectionType
          });
        }
      }
    }
    
    return { connections };
  }
  
  /**
   * Update progress for a job
   */
  private async updateProgress(id: string, progress: number): Promise<void> {
    const item = await this.getItem(id);
    if (item) {
      item.progress = progress;
      await this.saveItem(item);
    }
  }
  
  // IndexedDB helpers
  
  private getItem(id: string): Promise<QueueItem | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  
  private saveItem(item: QueueItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  private deleteItem(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  private getItemsByStatus(status: QueueStatus): Promise<QueueItem[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll(status);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let queueInstance: ProcessingQueue | null = null;

/**
 * Get or create processing queue
 */
export function getProcessingQueue(config?: Partial<QueueConfig>): ProcessingQueue {
  if (!queueInstance) {
    queueInstance = new ProcessingQueue(config);
  }
  return queueInstance;
}