// Use Processing Queue - React hook for async job management
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobType = 'extraction' | 'import' | 'connection' | 'embedding';

interface QueueJob {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: {
    beats?: Array<{ id: string; name: string }>;
    connections?: Array<{ from: string; to: string }>;
    notesCreated?: number;
    beatsExtracted?: number;
  };
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface UseQueueOptions {
  userId?: string;
  pollInterval?: number;
  onJobComplete?: (job: QueueJob) => void;
  onJobError?: (job: QueueJob, error: string) => void;
}

interface UseQueueResult {
  // State
  jobs: QueueJob[];
  stats: QueueStats | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  addExtractionJob: (noteId: string, text?: string) => Promise<string>;
  addImportJob: (filename: string, fileSize: number, totalChunks: number) => Promise<string>;
  addConnectionJob: (beatIds: string[]) => Promise<string>;
  cancelJob: (jobId: string, type?: JobType) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  refresh: () => Promise<void>;
  
  // Utility
  getJob: (jobId: string) => QueueJob | undefined;
  getPendingJobs: () => QueueJob[];
  getActiveJobs: () => QueueJob[];
}

/**
 * React hook for managing processing queue
 */
export function useQueue(options: UseQueueOptions = {}): UseQueueResult {
  const {
    userId,
    pollInterval = 5000, // 5 seconds
    onJobComplete,
    onJobError
  } = options;
  
  // State
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track completed jobs for callbacks
  const completedJobs = useRef<Set<string>>(new Set());
  
  // Fetch queue status
  const refresh = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/queue?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch queue');
      }
      
      const data = await response.json();
      
      // Transform imports to jobs
      const importJobs: QueueJob[] = (data.imports || []).map((imp: Record<string, unknown>) => ({
        id: imp.id as string,
        type: 'import' as JobType,
        status: mapImportStatus(imp.status as string),
        progress: calculateProgress(imp),
        createdAt: imp.createdAt as string,
        startedAt: imp.startedAt as string | undefined,
        completedAt: imp.completedAt as string | undefined,
        result: {
          notesCreated: imp.notesCreated as number,
          beatsExtracted: imp.beatsExtracted as number
        }
      }));
      
      setJobs(importJobs);
      setStats(data.stats);
      
      // Check for newly completed jobs
      for (const job of importJobs) {
        if (job.status === 'completed' && !completedJobs.current.has(job.id)) {
          completedJobs.current.add(job.id);
          onJobComplete?.(job);
        }
        
        if (job.status === 'failed' && !completedJobs.current.has(job.id)) {
          completedJobs.current.add(job.id);
          onJobError?.(job, job.error || 'Job failed');
        }
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId, onJobComplete, onJobError]);
  
  // Poll for updates
  useEffect(() => {
    refresh();
    
    if (pollInterval > 0 && userId) {
      const interval = setInterval(refresh, pollInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, pollInterval, userId]);
  
  // Add extraction job
  const addExtractionJob = useCallback(async (noteId: string, text?: string): Promise<string> => {
    const response = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'extraction',
        userId,
        data: { noteId, text }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to add extraction job');
    }
    
    const data = await response.json();
    refresh();
    return data.jobId;
  }, [userId, refresh]);
  
  // Add import job
  const addImportJob = useCallback(async (
    filename: string,
    fileSize: number,
    totalChunks: number
  ): Promise<string> => {
    const response = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'import',
        userId,
        data: { filename, fileSize, totalChunks }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to add import job');
    }
    
    const data = await response.json();
    refresh();
    return data.jobId;
  }, [userId, refresh]);
  
  // Add connection job
  const addConnectionJob = useCallback(async (beatIds: string[]): Promise<string> => {
    const response = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'connection',
        userId,
        data: { beatIds }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to add connection job');
    }
    
    const data = await response.json();
    refresh();
    return data.jobId;
  }, [userId, refresh]);
  
  // Cancel job
  const cancelJob = useCallback(async (jobId: string, type?: JobType): Promise<void> => {
    const response = await fetch(`/api/queue?jobId=${jobId}&type=${type || 'extraction'}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to cancel job');
    }
    
    refresh();
  }, [refresh]);
  
  // Retry job
  const retryJob = useCallback(async (jobId: string): Promise<void> => {
    // For imports, we'd need to store the original data
    // For now, just refresh
    refresh();
  }, [refresh]);
  
  // Utility functions
  const getJob = useCallback((jobId: string): QueueJob | undefined => {
    return jobs.find(j => j.id === jobId);
  }, [jobs]);
  
  const getPendingJobs = useCallback((): QueueJob[] => {
    return jobs.filter(j => j.status === 'pending');
  }, [jobs]);
  
  const getActiveJobs = useCallback((): QueueJob[] => {
    return jobs.filter(j => j.status === 'processing');
  }, [jobs]);
  
  return {
    jobs,
    stats,
    loading,
    error,
    addExtractionJob,
    addImportJob,
    addConnectionJob,
    cancelJob,
    retryJob,
    refresh,
    getJob,
    getPendingJobs,
    getActiveJobs
  };
}

// Helper functions
function mapImportStatus(status: string): JobStatus {
  switch (status) {
    case 'QUEUED':
    case 'UPLOADING':
      return 'pending';
    case 'PROCESSING':
      return 'processing';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    default:
      return 'pending';
  }
}

function calculateProgress(job: Record<string, unknown>): number {
  const total = job.totalChunks as number || 1;
  const processed = job.processedChunks as number || 0;
  return Math.round((processed / total) * 100);
}

export default useQueue;