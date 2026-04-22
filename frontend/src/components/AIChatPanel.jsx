import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, SendHorizonal, Sparkles } from "lucide-react";

const SPINNER_FRAMES = ["[ / ]", "[ — ]", "[ \\ ]", "[ | ]"];

function useAsciiSpinner(active) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 150);
    return () => clearInterval(id);
  }, [active]);
  return SPINNER_FRAMES[frame];
}

const QUICK_PROMPTS = [
  "What is the top issue in this report?",
  "Why does MOSAIC believe this finding?",
  "Why is the draft PR unavailable?",
  "How should the fix be changed?",
  "How should the tests be improved?",
];

export default function AIChatPanel({ report, isChatting, onSendChat }) {
  const [input, setInput] = useState("");
  const spinner = useAsciiSpinner(isChatting);

  useEffect(() => {
    setInput("");
  }, [report?.id]);

  const messages = useMemo(() => {
    if (report?.chat_history?.length) {
      return report.chat_history;
    }

    return [
      {
        role: "assistant",
        content: "Ask what the main issue is, why MOSAIC believes it, why the PR is or is not ready, or how you want the fix and tests changed.",
      },
    ];
  }, [report?.chat_history]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isChatting) return;
    setInput("");
    await onSendChat?.(report.id, message);
  };

  const handleQuickPrompt = async (prompt) => {
    if (isChatting) return;
    await onSendChat?.(report.id, prompt);
  };

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--surface)]">
            <MessageSquareText className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              AI Chat
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Ask where the problem is, why the verifier trusted or rejected it, and how the fix or tests should change before you open a PR.
            </p>
          </div>
        </div>
        {isChatting ? (
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent)]">
            <span className="w-10 text-center">{spinner}</span>
            thinking
          </span>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              data-testid={`quick-prompt-${prompt.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => handleQuickPrompt(prompt)}
              disabled={isChatting}
              className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--text-subtle)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="max-h-80 space-y-3 overflow-y-auto rounded-[20px] border border-[color:var(--border)] bg-[#05070b] p-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-[18px] px-3 py-2 text-sm leading-7 ${
                  message.role === "user"
                    ? "bg-[var(--text)] text-[var(--bg)]"
                    : "border border-[color:var(--border)] bg-[rgba(18,24,32,0.88)] text-[var(--text-secondary)]"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-[0.18em]">
                  {message.role === "assistant" ? (
                    <>
                      <Sparkles className="h-3 w-3 text-[var(--accent)]" strokeWidth={1.8} />
                      <span className="text-[var(--text-muted)]">AI</span>
                    </>
                  ) : (
                    <span className="text-black/60">You</span>
                  )}
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            data-testid="chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder="Ask what the top issue is, why the verifier agreed or pushed back, or tell the AI how to change the patch and tests..."
            className="w-full resize-none rounded-[20px] border border-[color:var(--border)] bg-[rgba(18,24,32,0.82)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              data-testid="chat-send-button"
              disabled={!input.trim() || isChatting}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--surface)] ${
                input.trim() && !isChatting
                  ? "border border-transparent bg-[var(--text)] text-[var(--bg)] hover:opacity-90"
                  : "cursor-not-allowed border border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-subtle)]"
              }`}
            >
              {isChatting ? (
                <>
                  <span className="font-mono text-xs w-10 text-center">{spinner}</span>
                  Sending...
                </>
              ) : (
                <>
                  <SendHorizonal className="w-4 h-4" strokeWidth={1.8} />
                  Send
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
