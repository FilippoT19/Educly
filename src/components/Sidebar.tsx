"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  BookOpen,
  LayoutDashboard,
  User,
  ChevronRight,
  FlaskConical,
  Cpu,
  Calculator,
  Atom,
  GraduationCap,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COURSES = [
  { id: "analisi1",  name: "Analisi 1",       icon: Calculator,  available: true },
  { id: "analisi2",  name: "Analisi 2",        icon: Calculator,  available: true },
  { id: "fisica1",   name: "Fisica 1",         icon: Atom,        available: false },
  { id: "fisica2",   name: "Fisica 2",         icon: Atom,        available: false },
  { id: "chimica",   name: "Chimica",          icon: FlaskConical,available: false },
  { id: "informatica",name: "Informatica",     icon: Cpu,         available: false },
  { id: "algebra",   name: "Algebra Lineare",  icon: GraduationCap,available: false },
];

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile",   label: "Profilo",   icon: User },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const activeSubject = COURSES.find((c) => pathname.includes(`/course/${c.id}`));
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "linear-gradient(180deg, #0c1729 0%, #080f1e 100%)",
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/5">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-2.5 group"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{
              background: "linear-gradient(135deg, #3b6ee8 0%, #2451c7 100%)",
              boxShadow: "0 2px 8px rgba(59,110,232,0.35)",
            }}
          >
            E
          </div>
          <span
            className="font-bold text-lg tracking-tight text-white"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Educly
          </span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="px-3 pt-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                active
                  ? "text-white bg-white/10 border-l-2 border-blue-400 pl-[10px]"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-3 border-t border-white/5" />

      {/* Courses label */}
      <div className="px-5 mb-2">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
          Corsi
        </p>
      </div>

      {/* Course list */}
      <nav className="px-3 space-y-0.5 flex-1 overflow-y-auto">
        {COURSES.map(({ id, name, icon: Icon, available }) => {
          const href = `/course/${id}`;
          const isActive = pathname.startsWith(href);

          if (!available) {
            return (
              <div
                key={id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/25 cursor-not-allowed select-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{name}</span>
                <span className="text-[10px] bg-white/5 rounded px-1.5 py-0.5 text-white/30">Presto</span>
              </div>
            );
          }

          return (
            <Link
              key={id}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "text-white bg-blue-500/15 border-l-2 border-blue-400 pl-[10px]"
                  : "text-white/65 hover:text-white hover:bg-white/8"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{name}</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-opacity",
                  isActive ? "opacity-60" : "opacity-20"
                )}
              />
            </Link>
          );
        })}
      </nav>

      {/* Subject sub-nav */}
      {activeSubject && (
        <div className="px-3 pt-2 border-t border-white/5">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-2 mb-1.5">
            {activeSubject.name}
          </p>
          {["Esercizi", "Teoria", "Simulazione", "Esame"].map((s) => (
            <Link
              key={s}
              href={`/course/${activeSubject.id}/${s.toLowerCase()}`}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
                pathname.includes(s.toLowerCase())
                  ? "text-blue-400 font-medium"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <BookOpen className="h-3 w-3 shrink-0" />
              {s}
            </Link>
          ))}
        </div>
      )}

      {/* Bottom: theme toggle */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors"
        >
          {resolvedTheme === "dark"
            ? <Sun className="h-3.5 w-3.5 shrink-0" />
            : <Moon className="h-3.5 w-3.5 shrink-0" />
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
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 h-screen sticky top-0 shrink-0"
        style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile: top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: "#0c1729", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span
          className="font-bold text-white"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Educly
        </span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 md:hidden flex flex-col">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}

export { COURSES };
