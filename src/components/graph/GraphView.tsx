'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'entity' | 'collection';
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'reference' | 'semantic' | 'temporal';
  strength: number;
}

interface GraphViewProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick?: (node: GraphNode) => void;
  className?: string;
}

export function GraphView({ nodes, links, onNodeClick, className }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Simple force simulation using basic physics
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const rect = svgRef.current.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });

    // Initialize positions randomly if not set
    const simulationNodes = nodes.map(node => ({
      ...node,
      x: node.x ?? Math.random() * rect.width,
      y: node.y ?? Math.random() * rect.height,
      vx: 0,
      vy: 0,
    }));

    // Create link lookup
    const nodeMap = new Map(simulationNodes.map(n => [n.id, n]));
    const linksWithNodes = links.map(link => ({
      source: nodeMap.get(link.source),
      target: nodeMap.get(link.target),
      type: link.type,
      strength: link.strength,
    })).filter(l => l.source && l.target);

    // Simple force simulation (100 iterations)
    for (let i = 0; i < 100; i++) {
      // Apply forces
      simulationNodes.forEach(node => {
        // Center gravity
        node.vx! += (rect.width / 2 - node.x!) * 0.01;
        node.vy! += (rect.height / 2 - node.y!) * 0.01;

        // Repulsion from other nodes
        simulationNodes.forEach(other => {
          if (node.id === other.id) return;
          const dx = node.x! - other.x!;
          const dy = node.y! - other.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1000 / (dist * dist);
          node.vx! += dx / dist * force;
          node.vy! += dy / dist * force;
        });
      });

      // Apply link forces
      linksWithNodes.forEach(link => {
        if (!link.source || !link.target) return;
        const dx = link.target.x! - link.source.x!;
        const dy = link.target.y! - link.source.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 150;
        const force = (dist - targetDist) * 0.05 * link.strength;
        link.source.vx! += dx / dist * force;
        link.source.vy! += dy / dist * force;
        link.target.vx! -= dx / dist * force;
        link.target.vy! -= dy / dist * force;
      });

      // Update positions
      simulationNodes.forEach(node => {
        if (node.fx !== undefined) {
          node.x = node.fx;
          node.vx = 0;
        } else {
          node.vx! *= 0.9; // Damping
          node.x! += node.vx!;
          node.x = Math.max(20, Math.min(rect.width - 20, node.x!));
        }

        if (node.fy !== undefined) {
          node.y = node.fy;
          node.vy = 0;
        } else {
          node.vy! *= 0.9;
          node.y! += node.vy!;
          node.y = Math.max(20, Math.min(rect.height - 20, node.y!));
        }
      });
    }

    // Store computed positions
    simulationNodes.forEach(node => {
      node.x = node.x;
      node.y = node.y;
    });
  }, [nodes, links]);

  const typeColors: Record<string, string> = {
    note: '#3B82F6',      // Blue
    entity: '#8B5CF6',    // Purple
    collection: '#22C55E', // Green
  };

  const linkColors: Record<string, string> = {
    reference: '#6366F1',
    semantic: '#EC4899',
    temporal: '#F59E0B',
  };

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return (
    <div className={cn('relative w-full h-full min-h-[400px]', className)}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="absolute inset-0"
      >
        {/* Links */}
        <g className="links">
          {links.map((link, i) => {
            const source = nodeMap.get(link.source);
            const target = nodeMap.get(link.target);
            if (!source?.x || !target?.x) return null;

            const isHighlighted = hoveredNode && 
              (link.source === hoveredNode || link.target === hoveredNode);

            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={linkColors[link.type] || '#6366F1'}
                strokeWidth={link.strength * 2}
                opacity={isHighlighted ? 1 : hoveredNode ? 0.1 : 0.6}
                strokeDasharray={link.type === 'semantic' ? '5,5' : undefined}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodes.map((node) => {
            if (!node.x || !node.y) return null;

            const isHovered = hoveredNode === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onNodeClick?.(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                {/* Node circle */}
                <circle
                  r={isHovered ? 20 : 16}
                  fill={typeColors[node.type] || '#6366F1'}
                  stroke="white"
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-150"
                />

                {/* Label */}
                {(isHovered || node.label.length < 10) && (
                  <text
                    textAnchor="middle"
                    dy={-24}
                    className="text-xs font-medium fill-foreground pointer-events-none"
                  >
                    {node.label.length > 20 ? node.label.slice(0, 20) + '...' : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur rounded-lg p-3 text-xs space-y-2">
        <div className="font-medium">Legend</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Notes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>Entities</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Collections</span>
        </div>
        <div className="border-t pt-2 mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-indigo-500" />
            <span>Reference</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-pink-500" style={{ borderStyle: 'dashed' }} />
            <span>Semantic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-amber-500" />
            <span>Temporal</span>
          </div>
        </div>
      </div>
    </div>
  );
}