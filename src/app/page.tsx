import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Educly</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Allenati con esercizi di Analisi 1 e 2 corretti dall&apos;intelligenza artificiale.
          Scopri dove sbagli, migliora argomento per argomento.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 h-9 text-sm font-medium transition-colors hover:opacity-90"
          >
            Inizia gratis
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 h-9 text-sm font-medium transition-colors hover:bg-muted"
          >
            Accedi
          </Link>
        </div>
      </div>
    </main>
  );
}
