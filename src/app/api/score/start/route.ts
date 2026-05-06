import { NextRequest, NextResponse } from "next/server";
import { startProfileRun, startGuardianRun } from "@/lib/apify";

export async function POST(req: NextRequest) {
  const { handle } = await req.json();

  if (!handle) {
    return NextResponse.json({ error: "Handle is required" }, { status: 400 });
  }

  try {
    const cleanHandle = handle.replace(/^@/, "").trim();

    const [profileRunId, guardianRunId] = await Promise.all([
      startProfileRun(cleanHandle),
      startGuardianRun(cleanHandle),
    ]);

    return NextResponse.json({ profileRunId, guardianRunId, handle: cleanHandle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
