// Rich Text Editor - TipTap-based editor with auto-formatting
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onFormat?: (format: string) => void;
}

// Simple rich text editor using contentEditable
// Full TipTap implementation would require additional dependencies
export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  className = '',
  autoFocus = false,
}: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Update counts
  useEffect(() => {
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const chars = content.length;
    setWordCount(words);
    setCharCount(chars);
  }, [content]);
  
  // Handle paste - strip formatting if needed
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);
  
  // Handle input
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    onChange(target.innerText || '');
  }, [onChange]);
  
  // Format commands
  const format = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value || undefined);
  }, []);
  
  // Auto-format while typing
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Auto-close quotes
    if (e.key === '"') {
      e.preventDefault();
      document.execCommand('insertText', false, '""');
      // Move cursor back one position
      const selection = window.getSelection();
      if (selection) {
        selection.modify('move', 'backward', 'character');
      }
      return;
    }
    
    // Auto-format markdown-style shortcuts
    const target = e.target as HTMLDivElement;
    const text = target.innerText;
    const lines = text.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Heading: # at start
    if (e.key === ' ' && currentLine === '#') {
      e.preventDefault();
      target.innerText = text.slice(0, -1);
      format('formatBlock', 'h1');
      return;
    }
    
    if (e.key === ' ' && currentLine === '##') {
      e.preventDefault();
      target.innerText = text.slice(0, -2);
      format('formatBlock', 'h2');
      return;
    }
    
    if (e.key === ' ' && currentLine === '###') {
      e.preventDefault();
      target.innerText = text.slice(0, -3);
      format('formatBlock', 'h3');
      return;
    }
    
    // List: - or * at start
    if (e.key === ' ' && (currentLine === '-' || currentLine === '*')) {
      e.preventDefault();
      target.innerText = text.slice(0, -1);
      format('insertUnorderedList');
      return;
    }
    
    // Numbered list: 1. at start
    if (e.key === ' ' && /^\d+\.$/.test(currentLine)) {
      e.preventDefault();
      target.innerText = text.slice(0, -currentLine.length);
      format('insertOrderedList');
      return;
    }
    
    // Horizontal rule: --- at start
    if (e.key === '-' && currentLine === '--') {
      e.preventDefault();
      target.innerText = text.slice(0, -2);
      format('insertHorizontalRule');
      return;
    }
  }, [format]);
  
  return (
    <div className={`rich-text-editor ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-700 bg-gray-800 rounded-t-lg">
        <button
          type="button"
          onClick={() => format('bold')}
          className="p-2 hover:bg-gray-700 rounded"
          title="Bold (Ctrl+B)"
        >
          <strong className="text-sm">B</strong>
        </button>
        <button
          type="button"
          onClick={() => format('italic')}
          className="p-2 hover:bg-gray-700 rounded"
          title="Italic (Ctrl+I)"
        >
          <em className="text-sm">I</em>
        </button>
        <button
          type="button"
          onClick={() => format('underline')}
          className="p-2 hover:bg-gray-700 rounded"
          title="Underline (Ctrl+U)"
        >
          <u className="text-sm">U</u>
        </button>
        <button
          type="button"
          onClick={() => format('strikeThrough')}
          className="p-2 hover:bg-gray-700 rounded"
          title="Strikethrough"
        >
          <s className="text-sm">S</s>
        </button>
        
        <div className="w-px h-6 bg-gray-600 mx-1" />
        
        <button
          type="button"
          onClick={() => format('formatBlock', 'h1')}
          className="px-2 py-1 hover:bg-gray-700 rounded text-sm font-bold"
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => format('formatBlock', 'h2')}
          className="px-2 py-1 hover:bg-gray-700 rounded text-sm font-bold"
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => format('formatBlock', 'h3')}
          className="px-2 py-1 hover:bg-gray-700 rounded text-sm font-bold"
          title="Heading 3"
        >
          H3
        </button>
        
        <div className="w-px h-6 bg-gray-600 mx-1" />
        
        <button
          type="button"
          onClick={() => format('insertUnorderedList')}
          className="p-2 hover:bg-gray-700 rounded"
          title="Bullet List"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => format('insertOrderedList')}
          className="p-2 hover:bg-gray-700 rounded"
          title="Numbered List"
        >
          1.
        </button>
        
        <div className="w-px h-6 bg-gray-600 mx-1" />
        
        <button
          type="button"
          onClick={() => format('formatBlock', 'blockquote')}
          className="p-2 hover:bg-gray-700 rounded text-sm"
          title="Quote"
        >
          "
        </button>
        <button
          type="button"
          onClick={() => format('formatBlock', 'pre')}
          className="p-2 hover:bg-gray-700 rounded text-xs font-mono"
          title="Code Block"
        >
          {'</>'}
        </button>
        
        <div className="flex-1" />
        
        {/* Word count */}
        <div className="text-xs text-gray-400 px-2">
          {wordCount.toLocaleString()} words • {charCount.toLocaleString()} chars
        </div>
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`min-h-[400px] p-4 bg-gray-900 rounded-b-lg outline-none ${
          isFocused ? 'ring-2 ring-blue-500' : ''
        }`}
        style={{ lineHeight: '1.7' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      >
        {content}
      </div>
      
      {/* Auto-formatting hints */}
      <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-4">
        <span># + Space = Heading</span>
        <span>- + Space = Bullet List</span>
        <span>1. + Space = Numbered List</span>
        <span>--- = Horizontal Rule</span>
      </div>
      
      <style jsx>{`
        .rich-text-editor [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

export default RichTextEditor;