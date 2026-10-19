import { type AgentEvent, AskRequestSchema } from "@budget/shared";
import { Router } from "express";
import type { InsightsService } from "../agent/insightsService";
import { AppError } from "../errors";
import type { ProposalService } from "../services/proposalService";
import { parse } from "../validation";

export function insightsRoutes(insights: InsightsService): Router {
  const router = Router();

  // Answers stream back as Server-Sent Events: one `data:` line of JSON per AgentEvent.
  router.post("/ask", async (request, response) => {
    const question = parse(AskRequestSchema, request.body);
    insights.assertAvailable();

    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const clientGone = new AbortController();
    response.on("close", () => {
      if (!response.writableEnded) clientGone.abort();
    });

    const send = (event: AgentEvent) => response.write(`data: ${JSON.stringify(event)}\n\n`);
    try {
      await insights.ask(question, send, clientGone.signal);
    } catch (error) {
      // Headers are already sent, so errors must travel as an event, not a JSON response.
      if (!(error instanceof AppError)) console.error("Ask AI failed:", error);
      send({
        type: "error",
        message:
          error instanceof AppError ? error.message : "Something went wrong while answering. Try again.",
      });
    }
    response.end();
  });

  return router;
}

export function proposalRoutes(proposals: ProposalService): Router {
  const router = Router();

  router.post("/:id/approve", async (request, response) => {
    response.json(await proposals.approve(request.params.id));
  });

  router.post("/:id/reject", (request, response) => {
    response.json(proposals.reject(request.params.id));
  });

  return router;
}
