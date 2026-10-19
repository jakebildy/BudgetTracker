import {
  criteriaFromQuery,
  ListTransactionsQuerySchema,
  type MonthsResponse,
  SummaryQuerySchema,
  TransactionInputSchema,
} from "@budget/shared";
import { Router } from "express";
import type { SummaryService } from "../services/summaryService";
import type { TransactionService } from "../services/transactionService";
import { parse } from "../validation";

export function transactionRoutes(transactions: TransactionService): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    const query = parse(ListTransactionsQuerySchema, request.query);
    response.json(await transactions.list(criteriaFromQuery(query)));
  });

  router.post("/", async (request, response) => {
    const input = parse(TransactionInputSchema, request.body);
    response.status(201).json(await transactions.create(input));
  });

  router.put("/:id", async (request, response) => {
    const input = parse(TransactionInputSchema, request.body);
    response.json(await transactions.update(request.params.id, input));
  });

  router.delete("/:id", async (request, response) => {
    await transactions.delete(request.params.id);
    response.status(204).end();
  });

  return router;
}

export function summaryRoutes(summary: SummaryService, transactions: TransactionService): Router {
  const router = Router();

  router.get("/summary", async (request, response) => {
    const { month } = parse(SummaryQuerySchema, request.query);
    response.json(await summary.summary(month));
  });

  router.get("/months", async (_request, response) => {
    const body: MonthsResponse = { months: await transactions.months() };
    response.json(body);
  });

  return router;
}
