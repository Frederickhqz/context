'use client';

import { useState, useEffect } from 'react';
import { useQueue, type JobStatus, type JobType } from '@/lib/hooks/use-queue';

interface QueuePanelProps {
  userId: string;
}

export function QueuePanel({ userId }: QueuePanelProps) {
  const {
    jobs,
    stats,
    loading,
    error,
    cancelJob,
    refresh
  } = useQueue({
    userId,
    pollInterval: 5000,
    onJobComplete: (job) => {
      console.log('Job completed:', job.id);
    },
    onJobError: (job, err) => {
      console.error('Job failed:', job.id, err);
    }
  });
  
  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'processing':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  const getStatusLabel = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };
  
  const getTypeIcon = (type: JobType) => {
    switch (type) {
      case 'extraction':
        return '⚡';
      case 'import':
        return '📥';
      case 'connection':
        return '🔗';
      case 'embedding':
        return '📊';
      default:
        return '📋';
    }
  };
  
  return (
    <div className="queue-panel bg-gray-900 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Processing Queue</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-xs text-gray-400">Queued</div>
          </div>
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.processing}</div>
            <div className="text-xs text-gray-400">Processing</div>
          </div>
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
            <div className="text-xs text-gray-400">Failed</div>
          </div>
        </div>
      )}
      
      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 rounded text-red-300 text-sm">
          {error}
        </div>
      )}
      
      {/* Jobs list */}
      {jobs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No jobs in queue
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-gray-800 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getTypeIcon(job.type)}</span>
                  <span className="font-medium capitalize">{job.type}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${getStatusColor(job.status)}`}
                  >
                    {getStatusLabel(job.status)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(job.createdAt).toLocaleTimeString()}
                </span>
              </div>
              
              {/* Progress bar */}
              {job.status === 'processing' && (
                <div className="mb-2">
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{job.progress}%</span>
                    {job.result?.notesCreated !== undefined && (
                      <span>{job.result.notesCreated} notes created</span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Result */}
              {job.status === 'completed' && job.result && (
                <div className="text-xs text-gray-400 mt-1">
                  {job.result.notesCreated !== undefined && (
                    <span>{job.result.notesCreated} notes, </span>
                  )}
                  {job.result.beatsExtracted !== undefined && (
                    <span>{job.result.beatsExtracted} beats extracted</span>
                  )}
                </div>
              )}
              
              {/* Error */}
              {job.status === 'failed' && job.error && (
                <div className="text-xs text-red-400 mt-1">
                  {job.error}
                </div>
              )}
              
              {/* Actions */}
              {(job.status === 'pending' || job.status === 'processing') && (
                <button
                  onClick={() => cancelJob(job.id, job.type)}
                  className="mt-2 px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs"
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default QueuePanel;