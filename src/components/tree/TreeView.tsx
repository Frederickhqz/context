'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';

interface TreeNode {
  id: string;
  label: string;
  type: 'note' | 'entity' | 'collection';
  children?: TreeNode[];
  expanded?: boolean;
}

interface TreeViewProps {
  data: TreeNode;
  onNodeClick?: (node: TreeNode) => void;
  className?: string;
}

export function TreeView({ data, onNodeClick, className }: TreeViewProps) {
  return (
    <div className={cn('p-4', className)}>
      <TreeNodeComponent 
        node={data} 
        level={0} 
        onNodeClick={onNodeClick} 
      />
    </div>
  );
}

interface TreeNodeProps {
  node: TreeNode;
  level: number;
  onNodeClick?: (node: TreeNode) => void;
}

function TreeNodeComponent({ node, level, onNodeClick }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(node.expanded ?? true);
  const hasChildren = node.children && node.children.length > 0;

  const typeIcons: Record<string, string> = {
    note: 'file',
    entity: 'tag',
    collection: 'folder',
  };

  const typeColors: Record<string, string> = {
    note: 'text-blue-600',
    entity: 'text-purple-600',
    collection: 'text-green-600',
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-lg',
          'hover:bg-muted transition-colors cursor-pointer',
          level === 0 && 'font-medium'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onNodeClick?.(node)}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-5 h-5 flex items-center justify-center hover:bg-muted-foreground/10 rounded"
          >
            <svg
              className={cn(
                'h-3 w-3 transition-transform',
                expanded && 'rotate-90'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Icon */}
        <Icon name={typeIcons[node.type] || 'tag'} size="sm" className={typeColors[node.type]} />

        {/* Label */}
        <span className={cn('text-sm', typeColors[node.type])}>
          {node.label}
        </span>

        {/* Child count badge */}
        {hasChildren && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {node.children!.length}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="border-l ml-4">
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to build tree from flat connections
export function buildTreeFromConnections(
  rootId: string,
  connections: Array<{
    fromNoteId: string;
    toNoteId: string;
    connectionType: string;
    fromNote?: { id: string; title: string | null };
    toNote?: { id: string; title: string | null };
  }>,
  visited = new Set<string>()
): TreeNode | null {
  if (visited.has(rootId)) return null;
  visited.add(rootId);

  // Get all outgoing connections from this node
  const outgoing = connections.filter(c => c.fromNoteId === rootId);
  
  const children: TreeNode[] = [];
  
  for (const conn of outgoing) {
    if (conn.toNote && !visited.has(conn.toNoteId)) {
      const childTree = buildTreeFromConnections(conn.toNoteId, connections, visited);
      if (childTree) {
        children.push(childTree);
      }
    }
  }

  // Find the note title
  const firstConn = connections.find(c => c.fromNoteId === rootId);
  const title = firstConn?.fromNote?.title || `Note ${rootId.slice(0, 4)}`;

  return {
    id: rootId,
    label: title,
    type: 'note',
    expanded: true,
    children: children.length > 0 ? children : undefined,
  };
}