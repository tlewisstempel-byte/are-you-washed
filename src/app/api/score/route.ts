import { NextRequest, NextResponse } from "next/server";
import { scrapeProfile } from "@/lib/apify";
import { calculateScore } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  const { handle } = await req.json();

  if (!handle) {
    return NextResponse.json({ error: "Handle is required" }, { status: 400 });
  }

  try {
    const { profile, guardian } = await scrapeProfile(handle.replace(/^@/, "").trim());
    const result = calculateScore(profile, guardian);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
