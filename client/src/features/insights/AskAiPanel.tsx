import { useEffect, useRef } from "react";
import { SparkleIcon } from "../../components/icons";
import { monthTitle } from "../../lib/format";
import styles from "./AskAiPanel.module.css";
import { ChatComposer } from "./ChatComposer";
import { Chart } from "./charts/Charts";
import { ProposalCard } from "./ProposalCard";
import { useAskAi } from "./useAskAi";

export function AskAiPanel({ month }: { month: string }) {
  const { messages, status, followUps, ask, approve, reject } = useAskAi(month);
  const logRef = useRef<HTMLDivElement>(null);
  const busy = status !== null;

  // Keep the newest message in view.
  useEffect(() => {
    if (logRef.current && messages.length > 0) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  return (
    <aside aria-labelledby="ask-ai-heading" className={styles.panel}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span aria-hidden="true" className={styles.badge}>
            <SparkleIcon size={18} />
          </span>
          <div>
            <h2 id="ask-ai-heading" className={styles.heading}>
              Ask AI
            </h2>
            <p className={styles.subheading}>
              Answers from your transactions, focused on {monthTitle(month)}
            </p>
          </div>
        </div>

        <div
          ref={logRef}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          aria-busy={busy}
          className={styles.log}
        >
          {messages.map((message, index) => {
            if (message.role === "user") {
              return (
                <p key={message.id} className={`${styles.bubble} ${styles.sent}`}>
                  {message.text}
                </p>
              );
            }
            // The answer appears whole when it's ready; until then, what the agent is doing.
            if (busy && index === messages.length - 1) {
              return (
                <p key={message.id} className={styles.status}>
                  {status}
                </p>
              );
            }
            return (
              <div key={message.id} className={styles.answer}>
                {message.text && <p className={`${styles.bubble} ${styles.received}`}>{message.text}</p>}
                {message.charts.map((chart) => (
                  <Chart key={`${chart.kind}-${chart.title}`} chart={chart} />
                ))}
                {message.proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onApprove={() => void approve(proposal.id)}
                    onReject={() => void reject(proposal.id)}
                  />
                ))}
                {message.error && (
                  <p role="alert" className={styles.error}>
                    {message.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <ChatComposer busy={busy} followUps={followUps} onSend={(question) => void ask(question)} />
      </div>
    </aside>
  );
}
