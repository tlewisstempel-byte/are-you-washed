import { NextRequest, NextResponse } from "next/server";
import { scrapeProfile } from "@/lib/apify";
import { calculateScore } from "@/lib/scoring";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { handle } = await req.json();
    const clean = String(handle ?? "").replace(/^@/, "").trim();
    if (!clean) return NextResponse.json({ error: "handle is required" }, { status: 400 });

    const { profile, guardian } = await scrapeProfile(clean);
    return NextResponse.json(calculateScore(profile, guardian));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
