import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="text-center space-y-6 max-w-xs">
        <p
          className="text-[88px] font-bold leading-none tracking-tight text-foreground/10"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
          aria-hidden
        >
          404
        </p>
        <div className="-mt-4 space-y-1.5">
          <h1 className="text-[20px] font-semibold tracking-tight">Pagina non trovata</h1>
          <p className="text-[14px] text-muted-foreground">
            Questo indirizzo non esiste o è stato rimosso.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors"
          >
            Torna alla dashboard
          </Link>
          <Link
            href="/course/analisi1"
            className="inline-flex items-center justify-center h-9 px-5 rounded-lg border bg-card text-[14px] font-medium hover:bg-muted/50 transition-colors"
          >
            Analisi 1
          </Link>
        </div>
      </div>
    </main>
  );
}
