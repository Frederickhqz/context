import { cn } from "@/lib/utils/cn";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Logo Mark - Connected nodes forming a "C" */}
      <svg
        className={cn(sizeClasses[size])}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient
            id="context-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient
            id="context-gradient-light"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#A5B4FC" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          cx="16"
          cy="16"
          r="15"
          fill="url(#context-gradient)"
        />

        {/* Connection lines */}
        <path
          d="M16 8 L16 16 L24 16"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />
        <path
          d="M8 16 L16 16 L16 24"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />

        {/* Main "C" shape made of connected nodes */}
        <circle cx="16" cy="8" r="2.5" fill="white" />
        <circle cx="24" cy="16" r="2.5" fill="white" />
        <circle cx="16" cy="16" r="3" fill="url(#context-gradient-light)" />
        <circle cx="8" cy="16" r="2.5" fill="white" />
        <circle cx="16" cy="24" r="2.5" fill="white" />

        {/* Connection highlights */}
        <circle cx="16" cy="16" r="1.5" fill="white" opacity="0.9" />
      </svg>

      {/* Wordmark */}
      {showText && (
        <span className={cn("font-semibold tracking-tight", textSizeClasses[size])}>
          <span className="bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 bg-clip-text text-transparent">
            Context
          </span>
        </span>
      )}
    </div>
  );
}

// Simplified icon-only version for tight spaces
export function LogoMark({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  return (
    <svg
      className={cn(sizeClasses[size], className)}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="context-mark-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>

      <circle cx="16" cy="16" r="15" fill="url(#context-mark-gradient)" />

      {/* Connection lines */}
      <path
        d="M16 8 L16 16 L24 16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <path
        d="M8 16 L16 16 L16 24"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />

      {/* Nodes */}
      <circle cx="16" cy="8" r="2.5" fill="white" />
      <circle cx="24" cy="16" r="2.5" fill="white" />
      <circle cx="16" cy="16" r="3" fill="white" opacity="0.5" />
      <circle cx="8" cy="16" r="2.5" fill="white" />
      <circle cx="16" cy="24" r="2.5" fill="white" />
      <circle cx="16" cy="16" r="1.5" fill="white" opacity="0.9" />
    </svg>
  );
}