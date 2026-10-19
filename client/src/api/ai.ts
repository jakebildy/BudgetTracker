import type { ApproveProposalResponse, AskRequest, RejectProposalResponse } from "@budget/shared";
import { request, send } from "./http";

/** Starts an Ask AI request. The response body is a Server-Sent Events stream. */
export function askInsights(body: AskRequest, signal: AbortSignal): Promise<Response> {
  return send("/api/insights/ask", { method: "POST", body, signal });
}

export function approveProposal(id: string): Promise<ApproveProposalResponse> {
  return request(`/api/proposals/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

export function rejectProposal(id: string): Promise<RejectProposalResponse> {
  return request(`/api/proposals/${encodeURIComponent(id)}/reject`, { method: "POST" });
}
