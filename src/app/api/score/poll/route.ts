import { NextRequest, NextResponse } from "next/server";
import { getRunStatus, buildScoreFromRun } from "@/lib/apify";

const TERMINAL = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const profileRunId = searchParams.get("profileRunId");
  const guardianRunId = searchParams.get("guardianRunId");
  const handle = searchParams.get("handle");

  if (!profileRunId || !handle) {
    return NextResponse.json({ error: "profileRunId and handle are required" }, { status: 400 });
  }

  try {
    const [profileStatus, guardianStatus] = await Promise.all([
      getRunStatus(profileRunId),
      guardianRunId ? getRunStatus(guardianRunId) : Promise.resolve("SKIPPED"),
    ]);

    if (!TERMINAL.includes(profileStatus)) {
      return NextResponse.json({ status: "running" });
    }

    if (profileStatus !== "SUCCEEDED") {
      return NextResponse.json(
        { status: "error", error: `Apify profile run ended: ${profileStatus}` },
        { status: 500 }
      );
    }

    if (guardianRunId && !TERMINAL.includes(guardianStatus)) {
      return NextResponse.json({ status: "running" });
    }

    const resolvedGuardianRunId =
      guardianRunId && guardianStatus === "SUCCEEDED" ? guardianRunId : null;

    const result = await buildScoreFromRun(handle, profileRunId, resolvedGuardianRunId);
    return NextResponse.json({ status: "done", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
