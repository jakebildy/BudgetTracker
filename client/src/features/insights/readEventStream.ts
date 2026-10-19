import type { AgentEvent } from "@budget/shared";

/** Reads a Server-Sent Events response body, yielding one parsed event per `data:` line. */
export async function* readEventStream(response: Response): AsyncGenerator<AgentEvent> {
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of chunk.split("\n")) {
        // Our own server writes these lines from the AgentEvent type in @budget/shared.
        if (line.startsWith("data: ")) yield JSON.parse(line.slice("data: ".length)) as AgentEvent;
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}
