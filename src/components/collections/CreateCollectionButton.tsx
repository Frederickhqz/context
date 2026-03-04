'use client';

import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { useState } from 'react';

interface CreateCollectionButtonProps {
  className?: string;
}

export function CreateCollectionButton({ className }: CreateCollectionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const colors = [
    '#6366F1', // Primary (Indigo)
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#22C55E', // Green
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EF4444', // Red
    '#14B8A6', // Teal
  ];

  const iconNames = ['folder', 'bookOpen', 'tag', 'pin', 'bookmark', 'clipboardList', 'file', 'sparkles'];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'transition-colors',
          className
        )}
      >
        <Icon name="plus" size="sm" />
        New Collection
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Collection</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <Icon name="close" size="md" />
              </button>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  placeholder="Collection name"
                  className="w-full rounded-lg border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  placeholder="What's this collection about?"
                  rows={2}
                  className="w-full rounded-lg border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-8 h-8 rounded-full border-2 border-transparent hover:border-foreground transition-colors"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {iconNames.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      className="w-10 h-10 rounded-lg border bg-background hover:bg-muted transition-colors flex items-center justify-center"
                    >
                      <Icon name={iconName} size="md" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}