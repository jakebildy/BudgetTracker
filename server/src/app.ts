// Builds the Express app from its dependencies. Does not listen, so tests can run it in-process.
import express from "express";
import type { AppDependencies } from "./container";
import { errorHandler, notFoundHandler } from "./http/errorHandler";
import { insightsRoutes, proposalRoutes } from "./http/insightsRoutes";
import { summaryRoutes, transactionRoutes } from "./http/transactionRoutes";

export function createApp(dependencies: AppDependencies): express.Express {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/transactions", transactionRoutes(dependencies.transactions));
  app.use("/api", summaryRoutes(dependencies.summary, dependencies.transactions));
  app.use("/api/insights", insightsRoutes(dependencies.insights));
  app.use("/api/proposals", proposalRoutes(dependencies.proposals));

  app.use("/api", notFoundHandler);
  app.use(errorHandler);
  return app;
}
