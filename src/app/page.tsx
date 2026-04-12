import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <span
          className="text-[20px] font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Educly
        </span>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Accedi
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8 py-20">

        <div className="space-y-4 max-w-lg">
          <h1
            className="text-5xl sm:text-7xl font-bold tracking-tight leading-none"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Educly
          </h1>
          <p className="text-[18px] sm:text-[20px] text-muted-foreground leading-relaxed">
            Il futuro dell&apos;Ieducazione.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Link
            href="/signup"
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground h-11 px-6 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            Inizia gratis
          </Link>
          <Link
            href="/login"
            className="flex-1 inline-flex items-center justify-center rounded-xl border border-border bg-background h-11 px-6 text-sm font-medium transition-colors hover:bg-muted"
          >
            Accedi
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {[
            "Correzione AI istantanea",
            "Soluzioni passo per passo",
            "Percorso adattivo",
            "Esercizi da temi d'esame reali",
          ].map((f) => (
            <span
              key={f}
              className="text-xs text-muted-foreground border border-border/60 rounded-full px-3 py-1"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border/50">
        Educly · MVP beta
      </footer>
    </main>
  );
}
