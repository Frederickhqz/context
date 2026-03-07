'use client';

import { useState, useCallback, useRef } from 'react';
import { useBookImport, type BookImportResult } from '@/lib/import/use-book-import';
import { Icon } from '@/components/ui/Icon';
import { BEAT_TYPE_CONFIG } from '@/lib/beats/types';

export function BookImportPage() {
  const [text, setText] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [author, setAuthor] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    importBook,
    loading,
    progress,
    status,
    result,
    error,
    reset,
  } = useBookImport();

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setText(content);

      // Auto-detect title from filename
      if (!bookTitle) {
        const name = file.name.replace(/\.[^/.]+$/, '');
        setBookTitle(name.replace(/[-_]/g, ' '));
      }
    };
    reader.readAsText(file);
  }, [bookTitle]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;

    await importBook(text, {
      bookTitle: bookTitle || 'Untitled Book',
      author: author || undefined,
      splitByChapters: true,
      extractConnections: true,
    });
  }, [text, bookTitle, author, importBook]);

  const handleReset = useCallback(() => {
    reset();
    setText('');
    setBookTitle('');
    setAuthor('');
  }, [reset]);

  // Result display component
  const ResultDisplay = ({ result }: { result: BookImportResult }) => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
        <h3 className="text-lg font-medium text-green-300 mb-2">
          ✅ Import Complete
        </h3>
        <p className="text-sm text-gray-300">
          <strong>{result.title}</strong> imported in {(result.processingTime / 1000).toFixed(1)}s
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-2xl font-bold text-white">{result.beats.total}</p>
          <p className="text-sm text-gray-400">Beats Extracted</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-2xl font-bold text-white">{result.connections.total}</p>
          <p className="text-sm text-gray-400">Connections</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-2xl font-bold text-white">
            {result.sections.processed}/{result.sections.total}
          </p>
          <p className="text-sm text-gray-400">Sections Processed</p>
        </div>
      </div>

      {/* Beats by Type */}
      {Object.keys(result.beats.byType).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Beats by Type</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(result.beats.byType)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 12)
              .map(([type, count]) => {
                const config = BEAT_TYPE_CONFIG[type as keyof typeof BEAT_TYPE_CONFIG];
                return (
                  <div
                    key={type}
                    className="flex items-center gap-2 bg-gray-800 rounded px-3 py-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config?.color || '#888' }}
                    />
                    <span className="text-sm text-gray-300">
                      {config?.label || type}
                    </span>
                    <span className="text-sm text-gray-500 ml-auto">
                      {count}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
        >
          Import Another
        </button>
        <a
          href="/mesh"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-center"
        >
          View in Mesh
        </a>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Import Book</h1>
        <p className="text-gray-400">
          Extract narrative beats from books, manuscripts, or long-form text.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
          <p className="font-medium">Import Failed</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && <ResultDisplay result={result} />}

      {/* Import Form */}
      {(!result || loading) && (
        <div className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Text File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-8 border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-lg text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Icon name="upload" size="lg" className="mb-2" />
              <p>Click to upload .txt or .md file</p>
            </button>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Book Title
              </label>
              <input
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="The Great Novel"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Author (optional)
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Jane Author"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
              />
            </div>
          </div>

          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Or Paste Text Directly
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your book text here..."
              rows={12}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {text.length.toLocaleString()} characters • ~{Math.ceil(text.split(/\s+/).length / 250)} pages
            </p>
          </div>

          {/* Progress */}
          {loading && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">{status}</span>
                <span className="text-sm text-gray-400">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={loading || !text.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium text-white"
            >
              {loading ? 'Importing...' : 'Import Book'}
            </button>
            {text && (
              <button
                onClick={() => {
                  setText('');
                  setBookTitle('');
                  setAuthor('');
                }}
                disabled={loading}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded text-gray-300"
              >
                Clear
              </button>
            )}
          </div>

          {/* Info */}
          <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
            <h4 className="font-medium text-gray-300 mb-2">How it works</h4>
            <ul className="space-y-1">
              <li>• Text is split into chapters or sections</li>
              <li>• Each section is analyzed with AI to extract beats</li>
              <li>• Connections between beats are identified</li>
              <li>• Results appear in your Beat Mesh view</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookImportPage;