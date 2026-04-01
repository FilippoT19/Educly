import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="space-y-6 max-w-sm">
        {/* Glitchy 404 */}
        <div className="relative select-none">
          <p
            className="text-[7rem] font-bold leading-none tracking-tighter text-primary/10"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            404
          </p>
          <p
            className="absolute inset-0 text-[7rem] font-bold leading-none tracking-tighter text-primary/30 translate-x-0.5 translate-y-0.5"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
            aria-hidden
          >
            404
          </p>
          <p
            className="absolute inset-0 text-[7rem] font-bold leading-none tracking-tighter text-primary"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
            aria-hidden
          >
            404
          </p>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Pagina non trovata</h1>
          <p className="text-sm text-muted-foreground">
            Questa pagina non esiste o è stata spostata.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Torna alla dashboard
          </Link>
          <Link
            href="/course/analisi1"
            className="inline-flex items-center justify-center h-10 px-6 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
          >
            Vai ad Analisi 1
          </Link>
        </div>
      </div>
    </div>
  );
}
