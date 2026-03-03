"use client";

import { Chrono } from "react-chrono";
import { useMemo } from "react";
import { TimelineItem } from "@/types";

interface TimelineProps {
  items: TimelineItem[];
  mode?: "HORIZONTAL" | "VERTICAL";
  onItemClick?: (id: string) => void;
}

export function Timeline({ items, mode = "VERTICAL", onItemClick }: TimelineProps) {
  const chronoItems = useMemo(() => {
    return items.map((item) => ({
      title: item.title,
      cardTitle: item.title,
      cardSubtitle: formatDateTime(item.date),
      cardDetailedText: item.content,
    }));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium">No timeline items</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Timeline items will appear here as you create notes and beats.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Chrono
        items={chronoItems}
        mode={mode}
        slideShow={false}
        scrollable
        useReadMore
        onItemSelected={(selected) => {
          const index = chronoItems.findIndex((item) => item.title === selected.title);
          if (index >= 0 && items[index]) {
            onItemClick?.(items[index].id);
          }
        }}
        theme={{
          primary: "#6366F1",
          secondary: "#818CF8",
          cardBgColor: "#FFFFFF",
          cardForeColor: "#1F2937",
          titleColor: "#6366F1",
        }}
      />
    </div>
  );
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}