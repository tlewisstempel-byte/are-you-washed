import { NextRequest, NextResponse } from "next/server";
import { getRunStatus, buildScoreFromRun } from "@/lib/apify";

const TERMINAL_STATUSES = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  const handle = searchParams.get("handle");

  if (!runId || !handle) {
    return NextResponse.json({ error: "runId and handle are required" }, { status: 400 });
  }

  try {
    const status = await getRunStatus(runId);

    if (!TERMINAL_STATUSES.includes(status)) {
      return NextResponse.json({ status: "running" });
    }

    if (status !== "SUCCEEDED") {
      return NextResponse.json(
        { status: "error", error: `Apify run ended with status: ${status}` },
        { status: 500 }
      );
    }

    const result = await buildScoreFromRun(handle, runId);
    return NextResponse.json({ status: "done", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
