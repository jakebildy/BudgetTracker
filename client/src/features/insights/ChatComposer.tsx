import { SUGGESTED_QUESTIONS } from "@budget/shared";
import { useState } from "react";
import { SendIcon } from "../../components/icons";
import styles from "./AskAiPanel.module.css";

type Props = {
  busy: boolean;
  /** Questions suggested after the latest answer. The defaults are shown when there are none. */
  followUps: readonly string[];
  onSend: (question: string) => void;
};

/** Suggestion chips and the question input. */
export function ChatComposer({ busy, followUps, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const suggestions = followUps.length > 0 ? followUps : SUGGESTED_QUESTIONS;
  const canSend = !busy && draft.trim() !== "";

  function send() {
    if (!canSend) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <div className={styles.composer}>
      <div className={styles.suggestions}>
        {suggestions.map((question) => (
          <button
            key={question}
            type="button"
            className={styles.chip}
            disabled={busy}
            onClick={() => onSend(question)}
          >
            {question}
          </button>
        ))}
      </div>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label htmlFor="ask-ai-input" className="visually-hidden">
          Ask about your spending
        </label>
        <input
          id="ask-ai-input"
          type="text"
          autoComplete="off"
          maxLength={500}
          placeholder="Ask about your spending…"
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" aria-label="Send" className={styles.send} disabled={!canSend}>
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
