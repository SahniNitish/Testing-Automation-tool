import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquareText, SendHorizonal, Sparkles } from "lucide-react";

const QUICK_PROMPTS = [
  "What's the main problem in this code?",
  "Where exactly is the bug and why?",
  "Modify the fix to be safer and more complete.",
  "Add stronger custom tests for this issue.",
];

export default function AIChatPanel({ report, isChatting, onSendChat }) {
  const [input, setInput] = useState("");

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
        content: "Ask me what is wrong, where the issue is, or how you want the fix and tests changed.",
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
    <section className="bg-[#121214] border border-white/[0.06] rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm border border-white/10 bg-black/20 flex items-center justify-center">
            <MessageSquareText className="w-4 h-4 text-sky-300" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              AI Chat
            </h3>
            <p className="text-sm text-zinc-300">
              Ask what is broken, request changes, or refine the patch before opening the PR.
            </p>
          </div>
        </div>
        {isChatting ? (
          <span className="flex items-center gap-1.5 text-[11px] text-sky-300 font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
            thinking
          </span>
        ) : null}
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleQuickPrompt(prompt)}
              disabled={isChatting}
              className="px-2.5 py-1.5 rounded-sm border border-white/10 bg-black/20 text-[11px] text-zinc-300 hover:text-white hover:border-white/20 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="bg-black/30 border border-white/[0.06] rounded-sm p-3 max-h-80 overflow-y-auto space-y-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-sm px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-white text-black"
                    : "bg-[#18181b] border border-white/[0.06] text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-[0.18em]">
                  {message.role === "assistant" ? (
                    <>
                      <Sparkles className="w-3 h-3 text-sky-300" strokeWidth={1.8} />
                      <span className="text-zinc-500">AI</span>
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
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder="Ask where the bug is, why the fix matters, or tell the AI how to modify the patch..."
            className="w-full bg-black/30 border border-white/10 rounded-sm px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!input.trim() || isChatting}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-semibold transition-colors duration-150 ${
                input.trim() && !isChatting
                  ? "bg-white text-black hover:bg-zinc-200"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {isChatting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
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
