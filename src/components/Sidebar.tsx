"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, User, Calculator, Atom, FlaskConical,
  Cpu, GraduationCap, Menu, X, Sun, Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COURSES = [
  { id: "analisi1",    name: "Analisi 1",       icon: Calculator,   available: true },
  { id: "analisi2",    name: "Analisi 2",        icon: Calculator,   available: true },
  { id: "fisica1",     name: "Fisica 1",         icon: Atom,         available: false },
  { id: "fisica2",     name: "Fisica 2",         icon: Atom,         available: false },
  { id: "chimica",     name: "Chimica",          icon: FlaskConical, available: false },
  { id: "informatica", name: "Informatica",      icon: Cpu,          available: false },
  { id: "algebra",     name: "Algebra Lineare",  icon: GraduationCap,available: false },
];

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile",   label: "Profilo",   icon: User },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: "#1c1c1e" }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/dashboard"
          onClick={onClose}
          className="text-white font-semibold text-[17px] tracking-tight"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Educly
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="px-2 pt-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13.5px] font-medium transition-colors",
                active
                  ? "text-white"
                  : "hover:bg-white/[0.06]"
              )}
              style={active
                ? { background: "oklch(0.648 0.220 256)", color: "white" }
                : { color: "rgba(255,255,255,0.60)" }
              }
            >
              <Icon className="h-[15px] w-[15px] shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* Courses section */}
      <div
        className="px-5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "rgba(255,255,255,0.28)" }}
      >
        Corsi
      </div>

      <nav className="px-2 space-y-0.5 flex-1 overflow-y-auto">
        {COURSES.map(({ id, name, icon: Icon, available }) => {
          const href = `/course/${id}`;
          const isActive = pathname.startsWith(href);

          if (!available) {
            return (
              <div
                key={id}
                className="flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13.5px] cursor-default"
                style={{ color: "rgba(255,255,255,0.22)" }}
              >
                <Icon className="h-[15px] w-[15px] shrink-0" />
                <span className="flex-1">{name}</span>
                <span
                  className="text-[10px] rounded px-1.5 py-0.5"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}
                >
                  Presto
                </span>
              </div>
            );
          }

          return (
            <Link
              key={id}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13.5px] font-medium transition-colors"
              )}
              style={isActive
                ? { background: "oklch(0.648 0.220 256)", color: "white" }
                : { color: "rgba(255,255,255,0.62)" }
              }
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              <Icon className="h-[15px] w-[15px] shrink-0" />
              {name}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="p-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2.5 w-full px-3 py-[7px] rounded-[8px] text-[13px] transition-colors"
          style={{ color: "rgba(255,255,255,0.38)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.38)";
          }}
        >
          {resolvedTheme === "dark"
            ? <Sun className="h-[14px] w-[14px] shrink-0" />
            : <Moon className="h-[14px] w-[14px] shrink-0" />
          }
          {resolvedTheme === "dark" ? "Modalità chiara" : "Modalità scura"}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden md:flex flex-col w-52 h-screen sticky top-0 shrink-0"
        style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center gap-3 px-4 h-12"
        style={{ background: "#1c1c1e", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <Menu className="h-5 w-5" />
        </button>
        <span
          className="font-semibold text-white text-[15px]"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Educly
        </span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-60 md:hidden flex flex-col">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}

export { COURSES };
