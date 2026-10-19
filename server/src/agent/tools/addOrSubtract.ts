import { formatDollars, subtractDollars, sumDollars } from "@budget/shared";
import { z } from "zod";
import { amountsIn } from "../grounding";
import { defineTool, ToolError } from "./defineTool";

export const addOrSubtract = defineTool({
  name: "add_or_subtract",
  description:
    "Adds or subtracts dollar amounts, so you never do arithmetic yourself. Use it to combine or compare " +
    "amounts from earlier tool results in this answer, for example the change in spending between two months. " +
    "Every amount must come from an earlier tool result. Quote the result exactly.",
  input: z.object({
    operation: z
      .enum(["add", "subtract"])
      .describe("add sums every amount. subtract takes the second amount from the first."),
    amounts: z
      .array(z.number())
      .min(2)
      .describe("Dollar amounts as numbers, such as 2312.99. Exactly two for subtract."),
  }),
  statusLabel: ({ operation }) => (operation === "add" ? "Adding amounts" : "Working out the difference"),
  run: async ({ operation, amounts }, context) => {
    const known = context.earlierResults().flatMap(amountsIn);
    const unknown = amounts.filter((amount) => !known.some((value) => Math.abs(value - amount) < 0.005));
    if (unknown.length > 0) {
      throw new ToolError(
        `${unknown.map(formatDollars).join(", ")} didn't come from an earlier tool result in this answer. ` +
          "Look the amounts up first, then add or subtract them.",
      );
    }
    if (operation === "subtract" && amounts.length !== 2) {
      throw new ToolError("subtract takes exactly two amounts: the first, then the one to take away.");
    }

    const [first = 0, second = 0] = amounts;
    const result = operation === "add" ? sumDollars(amounts) : subtractDollars(first, second);
    const symbol = operation === "add" ? " + " : " - ";
    return {
      result: formatDollars(result),
      calculation: `${amounts.map(formatDollars).join(symbol)} = ${formatDollars(result)}`,
    };
  },
});
