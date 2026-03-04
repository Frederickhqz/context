"use client";

import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-background border shadow-sm md:hidden"
        aria-label="Toggle menu"
      >
        <Icon name={isOpen ? "close" : "menu"} size="md" />
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 border-r transition-transform duration-200",
          "bg-sidebar text-sidebar-foreground",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          <Logo size="sm" />
        </div>

        <nav className="flex flex-col gap-1 p-4">
          <NavItem href="/notes" icon="file" active={pathname === "/notes" || pathname === "/"}>
            Notes
          </NavItem>
          <NavItem href="/timeline" icon="calendar" active={pathname === "/timeline"}>
            Timeline
          </NavItem>
          <NavItem href="/visualize" icon="diagram" active={pathname === "/visualize"}>
            Visualize
          </NavItem>
          <NavItem href="/entities" icon="users" active={pathname === "/entities"}>
            Entities
          </NavItem>
          <NavItem href="/collections" icon="folder" active={pathname === "/collections"}>
            Collections
          </NavItem>
          <NavItem href="/search" icon="search" active={pathname === "/search"}>
            Search
          </NavItem>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t p-4">
          <NavItem href="/settings" icon="settings" active={pathname === "/settings"}>
            Settings
          </NavItem>
        </div>
      </aside>
    </>
  );
}

interface NavItemProps {
  href: string;
  icon: string;
  children: React.ReactNode;
  active?: boolean;
}

function NavItem({ href, icon, children, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon name={icon} size="md" />
      {children}
    </Link>
  );
}