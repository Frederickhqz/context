"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

// Demo mode detection
const DEMO_MODE = true;

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    // Check for demo mode or Supabase auth
    if (DEMO_MODE) {
      setUser({ email: "demo@context.app" });
    }
  }, []);

  const handleLogout = async () => {
    // Demo mode - just clear local storage
    localStorage.clear();
    setUser(null);
    window.location.href = "/";
  };

  if (!user) {
    return (
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => window.location.href = "/login"}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Icon name="login" size="sm" />
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent rounded-lg hover:bg-sidebar-accent/80 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
          {user.email[0].toUpperCase()}
        </div>
        <span className="text-sm font-medium hidden sm:inline">
          {user.email.split("@")[0]}
        </span>
        <Icon name={isOpen ? "chevronUp" : "chevronDown"} size="sm" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-background border rounded-lg shadow-lg z-50">
            <div className="p-2 border-b">
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium truncate">{user.email}</p>
            </div>
            <div className="p-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = "/settings";
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
              >
                <Icon name="settings" size="sm" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors text-red-500"
              >
                <Icon name="logout" size="sm" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default UserMenu;