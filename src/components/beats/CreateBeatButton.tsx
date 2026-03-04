'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';

interface CreateBeatButtonProps {
  noteId?: string;
  onCreated?: (beat: any) => void;
  className?: string;
}

export function CreateBeatButton({ noteId, onCreated, className }: CreateBeatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const beatTypes = [
    { value: 'event', label: 'Event', icon: 'calendar', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    { value: 'milestone', label: 'Milestone', icon: 'check', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
    { value: 'feeling', label: 'Feeling', icon: 'sparkles', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    { value: 'insight', label: 'Insight', icon: 'lightbulb', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      beatType: formData.get('beatType'),
      intensity: parseInt(formData.get('intensity') as string) || 1,
      noteId: noteId || null,
      startedAt: formData.get('startedAt') || null,
      endedAt: formData.get('endedAt') || null,
    };

    try {
      const response = await fetch('/api/beats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create beat');

      const { beat } = await response.json();
      onCreated?.(beat);
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating beat:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
          'bg-amber-500 text-white',
          'hover:bg-amber-500/90',
          'transition-colors',
          className
        )}
      >
        <Icon name="bolt" size="sm" />
        New Beat
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Beat</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <Icon name="close" size="md" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Beat Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {beatTypes.map((type) => (
                    <label
                      key={type.value}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-3 cursor-pointer',
                        'hover:bg-muted transition-colors',
                        'has-[:checked]:ring-2 has-[:checked]:ring-primary'
                      )}
                    >
                      <input
                        type="radio"
                        name="beatType"
                        value={type.value}
                        defaultChecked={type.value === 'event'}
                        className="sr-only"
                        required
                      />
                      <Icon name={type.icon} size="md" className={type.color.split(' ')[1]} />
                      <span className="text-sm font-medium">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Intensity */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Intensity: <span id="intensity-value">1</span>
                </label>
                <input
                  type="range"
                  name="intensity"
                  min="1"
                  max="5"
                  defaultValue="1"
                  className="w-full"
                  onChange={(e) => {
                    document.getElementById('intensity-value')!.textContent = e.target.value;
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Mild</span>
                  <span>Intense</span>
                </div>
              </div>

              {/* Date/Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start</label>
                  <input
                    type="datetime-local"
                    name="startedAt"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End</label>
                  <input
                    type="datetime-local"
                    name="endedAt"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
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
                  disabled={isSubmitting}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Beat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}