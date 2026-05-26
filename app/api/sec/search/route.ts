import { NextRequest, NextResponse } from "next/server";

const SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json";
const UA = "MasterCMS-App nick.lynch.coaching@outlook.com";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
  if (!q) return NextResponse.json([]);

  try {
    const res = await fetch(SEC_TICKERS, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json([]);

    const data = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
    const results = Object.values(data)
      .filter((c) => c.title.toLowerCase().includes(q))
      .slice(0, 15)
      .map((c) => ({
        cik: String(c.cik_str).padStart(10, "0"),
        name: c.title,
        ticker: c.ticker || undefined,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
