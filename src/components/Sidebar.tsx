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
  {
    id: "analisi1",
    name: "Analisi 1",
    icon: Calculator,
    available: true,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    id: "analisi2",
    name: "Analisi 2",
    icon: Calculator,
    available: true,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    id: "fisica1",
    name: "Fisica 1",
    icon: Atom,
    available: false,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    id: "fisica2",
    name: "Fisica 2",
    icon: Atom,
    available: false,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    id: "chimica",
    name: "Chimica",
    icon: FlaskConical,
    available: false,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    id: "informatica",
    name: "Informatica",
    icon: Cpu,
    available: false,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    id: "algebra",
    name: "Algebra Lineare",
    icon: GraduationCap,
    available: false,
    color: "text-pink-600",
    bg: "bg-pink-50",
  },
];

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profilo", icon: User },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const activeSubject = COURSES.find((c) => pathname.includes(`/course/${c.id}`));
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl tracking-tight" onClick={onClose}>
          Educly
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-3 border-t" />

      {/* Courses */}
      <div className="px-4 mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          I tuoi corsi
        </p>
      </div>
      <nav className="px-3 space-y-0.5 flex-1 overflow-y-auto">
        {COURSES.map(({ id, name, icon: Icon, available, color, bg }) => {
          const href = `/course/${id}`;
          const isActive = pathname.startsWith(href);

          if (!available) {
            return (
              <div
                key={id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground/50 cursor-not-allowed select-none"
                title="Prossimamente"
              >
                <span className={cn("p-1 rounded-md", bg)}>
                  <Icon className={cn("h-3.5 w-3.5", color)} />
                </span>
                {name}
                <span className="ml-auto text-[10px] bg-muted rounded px-1.5 py-0.5">Presto</span>
              </div>
            );
          }

          return (
            <Link
              key={id}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <span className={cn("p-1 rounded-md", isActive ? "bg-white/20" : bg)}>
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-white" : color)} />
              </span>
              {name}
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40" />
            </Link>
          );
        })}
      </nav>

      {/* Bottom: subject quick-actions if active */}
      {activeSubject && (
        <div className="px-3 pt-2 border-t">
          <p className="text-xs text-muted-foreground px-2 mb-1">{activeSubject.name}</p>
          {["Esercizi", "Teoria", "Simulazione", "Esame"].map((s) => (
            <Link
              key={s}
              href={`/course/${activeSubject.id}/${s.toLowerCase()}`}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                pathname.includes(s.toLowerCase())
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {s}
            </Link>
          ))}
        </div>
      )}

      {/* Theme toggle */}
      <div className="p-3 border-t mt-auto">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {resolvedTheme === "dark"
            ? <Sun className="h-4 w-4 shrink-0" />
            : <Moon className="h-4 w-4 shrink-0" />
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
      <aside className="hidden md:flex flex-col w-60 border-r bg-background h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile: top bar + drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 border-b bg-background">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold">Educly</span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-background border-r md:hidden flex flex-col">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}

export { COURSES };
