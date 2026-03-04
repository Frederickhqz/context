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
      {/* Logo Mark - C made of connected nodes */}
      <svg
        className={cn(sizeClasses[size])}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A5B4FC" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
        </defs>

        {/* C curve (connecting path) */}
        <path
          d="M22 6 C10 6 6 12 6 16 C6 20 10 26 22 26"
          stroke="url(#logo-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />

        {/* Nodes forming the C shape */}
        {/* Top end */}
        <circle cx="20" cy="6" r="4" fill="url(#logo-gradient)" />
        <circle cx="20" cy="6" r="2" fill="white" opacity="0.5" />

        {/* Top curve */}
        <circle cx="12" cy="9" r="3" fill="url(#logo-gradient)" />

        {/* Left side (inner) */}
        <circle cx="8" cy="14" r="2.5" fill="url(#logo-gradient)" />
        <circle cx="8" cy="18" r="2.5" fill="url(#logo-gradient)" />

        {/* Bottom curve */}
        <circle cx="12" cy="23" r="3" fill="url(#logo-gradient)" />

        {/* Bottom end */}
        <circle cx="20" cy="26" r="4" fill="url(#logo-gradient)" />
        <circle cx="20" cy="26" r="2" fill="white" opacity="0.5" />
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
        <linearGradient id="mark-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A5B4FC" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>

      {/* C curve */}
      <path
        d="M22 6 C10 6 6 12 6 16 C6 20 10 26 22 26"
        stroke="url(#mark-gradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Nodes */}
      <circle cx="20" cy="6" r="4" fill="url(#mark-gradient)" />
      <circle cx="20" cy="6" r="2" fill="white" opacity="0.5" />
      <circle cx="12" cy="9" r="3" fill="url(#mark-gradient)" />
      <circle cx="8" cy="14" r="2.5" fill="url(#mark-gradient)" />
      <circle cx="8" cy="18" r="2.5" fill="url(#mark-gradient)" />
      <circle cx="12" cy="23" r="3" fill="url(#mark-gradient)" />
      <circle cx="20" cy="26" r="4" fill="url(#mark-gradient)" />
      <circle cx="20" cy="26" r="2" fill="white" opacity="0.5" />
    </svg>
  );
}