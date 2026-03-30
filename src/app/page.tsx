import Link from "next/link";
import { Button } from "@/components/ui/button";

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
          <Button asChild size="lg">
            <Link href="/signup">Inizia gratis</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Accedi</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
