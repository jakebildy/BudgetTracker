import type { AgentEvent } from "@budget/shared";

/**
 * Holds the agent's events while the scope check runs. Once the question is
 * known to be in scope, `release` sends what was held and passes later events
 * straight through. `discard` drops everything if the question was off topic.
 */
export class HeldEvents {
  private held: AgentEvent[] = [];
  private state: "holding" | "released" | "discarded" = "holding";

  constructor(private readonly send: (event: AgentEvent) => void) {}

  readonly emit = (event: AgentEvent): void => {
    if (this.state === "released") this.send(event);
    else if (this.state === "holding") this.held.push(event);
  };

  release(): void {
    this.state = "released";
    for (const event of this.held) this.send(event);
    this.held = [];
  }

  discard(): void {
    this.state = "discarded";
    this.held = [];
  }
}
