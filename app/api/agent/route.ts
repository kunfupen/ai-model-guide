import { NextRequest } from "next/server";
import { RECORDED_RUN } from "@/lib/agentTranscript";

// The Python agent is a separate service. Proxying through a route handler keeps
// AGENT_API_URL (and any auth on it) server-side — the browser only ever talks to
// this origin.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_API_URL = process.env.AGENT_API_URL;

/** Replay a recorded run so the page still demos when the backend isn't deployed. */
function replayRecording(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: start\ndata: ${JSON.stringify({ thread_id: "recorded", recorded: true })}\n\n`,
        ),
      );
      for (const step of RECORDED_RUN) {
        // Pace the replay so the trace reads the way a live run does.
        await new Promise((resolve) => setTimeout(resolve, step.delayMs ?? 450));
        controller.enqueue(
          encoder.encode(`event: ${step.event}\ndata: ${JSON.stringify(step.data)}\n\n`),
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  let body: { question?: unknown; thread_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > 1000) {
    return Response.json(
      { error: "Ask a question between 3 and 1000 characters." },
      { status: 400 },
    );
  }

  if (!AGENT_API_URL) return replayRecording();

  const controller = new AbortController();
  // The agent can legitimately run for a while; cap it so a wedged backend
  // doesn't hold the connection open indefinitely.
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const upstream = await fetch(`${AGENT_API_URL.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({
        question,
        thread_id: typeof body.thread_id === "string" ? body.thread_id : undefined,
      }),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      let message = "The agent backend is unavailable.";
      try {
        message = (JSON.parse(detail) as { error?: string }).error ?? message;
      } catch {
        /* non-JSON error body — keep the generic message */
      }
      return Response.json({ error: message }, { status: upstream.status || 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return Response.json(
      { error: aborted ? "The agent took too long to respond." : "Could not reach the agent." },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
