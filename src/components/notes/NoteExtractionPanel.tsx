// Note Extraction Panel - UI for triggering beat extraction
'use client';

import { useState } from 'react';

interface NoteExtractionPanelProps {
  noteId: string;
  onExtracted?: (beats: Array<{ id: string; name: string; type: string }>) => void;
}

export function NoteExtractionPanel({ noteId, onExtracted }: NoteExtractionPanelProps) {
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    beatsExtracted: number;
    connectionsCreated: number;
    embeddingsQueued: number;
  } | null>(null);

  const handleExtract = async (fullAnalysis: boolean = true) => {
    setExtracting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/notes/${noteId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'cloud' })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Extraction failed');
      }

      const data = await response.json();
      setResult({
        beatsExtracted: data.beatsExtracted,
        connectionsCreated: data.connectionsCreated,
        embeddingsQueued: data.embeddingsQueued
      });

      onExtracted?.(data.beats || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-medium mb-3">Beat Extraction</h3>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleExtract(true)}
          disabled={extracting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm"
        >
          {extracting ? 'Extracting...' : 'Extract & Analyze'}
        </button>

        <button
          onClick={() => handleExtract(false)}
          disabled={extracting}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded text-sm"
        >
          Quick Extract
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-900/50 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-3 p-3 bg-green-900/30 rounded text-sm">
          <div className="font-medium text-green-400 mb-1">Extraction Complete</div>
          <div className="text-gray-300">
            <span className="text-green-400">{result.beatsExtracted}</span> beats extracted
            {result.connectionsCreated > 0 && (
              <>, <span className="text-blue-400">{result.connectionsCreated}</span> connections</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NoteExtractionPanel;