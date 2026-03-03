'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { cn } from '@/lib/utils/cn';

interface CalendarViewProps {
  events: Array<{
    id: string;
    date: string | Date;
    type: 'note' | 'beat' | 'event';
    title?: string;
  }>;
  onDateSelect?: (date: Date) => void;
  onEventSelect?: (event: any) => void;
}

export function CalendarView({ events, onDateSelect, onEventSelect }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const dateKey = typeof event.date === 'string' 
      ? parseISO(event.date).toISOString().split('T')[0]
      : event.date.toISOString().split('T')[0];
    
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, typeof events>);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="rounded-lg p-2 hover:bg-muted transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={goToNextMonth}
            className="rounded-lg p-2 hover:bg-muted transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          onClick={goToToday}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Today
        </button>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before month start */}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Month days */}
        {days.map((day) => {
          const dateKey = day.toISOString().split('T')[0];
          const dayEvents = eventsByDate[dateKey] || [];
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={dateKey}
              onClick={() => handleDateClick(day)}
              className={cn(
                'aspect-square rounded-lg p-1 text-left transition-colors',
                'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary',
                isToday && 'ring-2 ring-primary',
                isSelected && 'bg-primary/10'
              )}
            >
              <div className={cn(
                'text-sm font-medium',
                isToday ? 'text-primary' : 'text-foreground'
              )}>
                {format(day, 'd')}
              </div>
              
              {/* Event indicators */}
              {dayEvents.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {dayEvents.slice(0, 3).map((event, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        event.type === 'note' && 'bg-blue-500',
                        event.type === 'beat' && 'bg-amber-500',
                        event.type === 'event' && 'bg-green-500'
                      )}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Events */}
      {selectedDate && eventsByDate[selectedDate.toISOString().split('T')[0]] && (
        <div className="mt-4 space-y-2">
          <h3 className="font-medium">
            {format(selectedDate, 'EEEE, MMMM d')}
          </h3>
          <div className="space-y-1">
            {eventsByDate[selectedDate.toISOString().split('T')[0]].map((event) => (
              <button
                key={event.id}
                onClick={() => onEventSelect?.(event)}
                className={cn(
                  'w-full rounded-lg p-2 text-left text-sm',
                  'hover:bg-muted transition-colors',
                  'border-l-4',
                  event.type === 'note' && 'border-l-blue-500 bg-blue-500/5',
                  event.type === 'beat' && 'border-l-amber-500 bg-amber-500/5',
                  event.type === 'event' && 'border-l-green-500 bg-green-500/5'
                )}
              >
                {event.title || `${event.type} #${event.id.slice(0, 4)}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}