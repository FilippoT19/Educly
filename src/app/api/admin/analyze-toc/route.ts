import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const ADMIN_SECRET = process.env.ADMIN_SECRET!;

export interface TocChapter {
  title: string;
  toc_page: number;
  pdf_page_index: number;
}

export async function POST(request: NextRequest) {
  if (request.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const prompt = `Analizza questo PDF di un libro di testo universitario.

Obiettivo: trovare dove inizia ogni capitolo nel PDF, tenendo conto che i numeri di pagina nell'indice NON corrispondono necessariamente agli indici reali delle pagine PDF (c'è spesso uno scarto causato da copertina, prefazione, indice stesso, ecc.).

Procedura:
1. Leggi l'indice (sommario) del libro e identifica i capitoli principali con i loro numeri di pagina nominali
2. Per ogni capitolo, cerca nell'effettivo contenuto del PDF dove appare il titolo del capitolo
3. Se non trovi il titolo esattamente alla pagina indicata dall'indice, cerca nelle 15 pagine successive fino a trovarlo
4. Riporta l'indice 0-based della pagina PDF dove inizia effettivamente il capitolo (prima pagina del PDF = indice 0)

Regole:
- Includi solo i capitoli principali, NON le sottosezioni
- Se un capitolo non ha una pagina di inizio chiaramente identificabile, omettilo
- Sii preciso: verifica che la pagina trovata contenga effettivamente il titolo del capitolo

Restituisci SOLO un array JSON valido, niente altro:
[
  {
    "title": "titolo esatto del capitolo",
    "toc_page": 42,
    "pdf_page_index": 47
  }
]`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "Non riesco a trovare un indice strutturato nel documento" },
      { status: 422 }
    );
  }

  const chapters: TocChapter[] = JSON.parse(jsonMatch[0]);
  return NextResponse.json({ chapters });
}
