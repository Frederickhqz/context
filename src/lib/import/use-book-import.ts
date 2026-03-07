// Book Import Hook - React hook for importing books
'use client';

import { useState, useCallback } from 'react';

export interface BookImportOptions {
  bookTitle?: string;
  author?: string;
  splitByChapters?: boolean;
  maxSectionLength?: number;
  extractConnections?: boolean;
}

export interface BookImportResult {
  success: boolean;
  bookId: string;
  title: string;
  sections: {
    total: number;
    processed: number;
    failed: number;
  };
  beats: {
    total: number;
    byType: Record<string, number>;
  };
  connections: {
    total: number;
  };
  processingTime: number;
}

export interface UseBookImportResult {
  importBook: (text: string, options?: BookImportOptions) => Promise<BookImportResult | null>;
  loading: boolean;
  progress: number;
  status: string;
  result: BookImportResult | null;
  error: Error | null;
  reset: () => void;
}

/**
 * Hook for importing books and extracting beats
 */
export function useBookImport(userId?: string): UseBookImportResult {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<BookImportResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const importBook = useCallback(async (
    text: string,
    options: BookImportOptions = {}
  ): Promise<BookImportResult | null> => {
    if (!text || text.trim().length < 100) {
      setError(new Error('Text must be at least 100 characters'));
      return null;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStatus('Uploading text...');

    try {
      setProgress(10);
      setStatus('Analyzing text structure...');

      const response = await fetch('/api/imports/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          bookTitle: options.bookTitle || 'Untitled Book',
          author: options.author,
          splitByChapters: options.splitByChapters ?? true,
          maxSectionLength: options.maxSectionLength || 10000,
          extractConnections: options.extractConnections ?? true,
          userId,
        }),
      });

      setProgress(50);
      setStatus('Extracting beats...');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import book');
      }

      const data: BookImportResult = await response.json();

      setProgress(100);
      setStatus('Complete!');
      setResult(data);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const reset = useCallback(() => {
    setLoading(false);
    setProgress(0);
    setStatus('');
    setResult(null);
    setError(null);
  }, []);

  return {
    importBook,
    loading,
    progress,
    status,
    result,
    error,
    reset,
  };
}

export default useBookImport;