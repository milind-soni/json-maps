"use client";

import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  patchCount?: number;
}

interface ChatSidebarProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  onSend: (prompt: string) => void;
  onStop: () => void;
  onClear: () => void;
  onClose: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

const SUGGESTIONS = [
  "Show earthquakes worldwide",
  "Dark map of Tokyo with landmarks",
  "Road trip route from Mumbai to Goa",
  "Population heatmap of the world",
  "Cafes in NYC with clusters",
];

export function ChatSidebar({
  messages,
  isStreaming,
  streamingText,
  onSend,
  onStop,
  onClear,
  onClose,
  inputRef: externalInputRef,
}: ChatSidebarProps) {
  const [input, setInput] = useState("");
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef || internalInputRef;

  const showMessages = messages.length > 0 || isStreaming;

  // Scroll to bottom when messages change
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, isStreaming, streamingText]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isStreaming) return;
      const text = input.trim();
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      onSend(text);
    },
    [input, isStreaming, onSend, inputRef],
  );

  const handleSuggestion = useCallback(
    (text: string) => {
      if (isStreaming) return;
      onSend(text);
    },
    [isStreaming, onSend],
  );

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <span className="text-sm font-medium">json-maps AI</span>
        <div className="flex items-center gap-3">
          {showMessages && (
            <button
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear conversation"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close panel"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content: suggestions or messages */}
      {showMessages ? (
        <div
          ref={messagesScrollRef}
          className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto"
        >
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div className="space-y-2">
                  {msg.content && (
                    <div className="text-sm text-foreground/90 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                      <Streamdown plugins={{ code }}>
                        {msg.content}
                      </Streamdown>
                    </div>
                  )}
                  {msg.patchCount != null && msg.patchCount > 0 && (
                    <div className="text-xs text-muted-foreground/60 font-mono">
                      Applied {msg.patchCount}{" "}
                      {msg.patchCount === 1 ? "change" : "changes"}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Streaming */}
          {isStreaming && (
            <div className="space-y-2">
              {streamingText ? (
                <div className="text-sm text-foreground/90 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown plugins={{ code }} animated>
                    {streamingText}
                  </Streamdown>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground animate-shimmer">
                  Thinking...
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap gap-2 p-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSuggestion(s)}
                className="text-xs px-3 py-1.5 rounded-full border bg-secondary font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-4 py-3 border-t shrink-0"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          rows={1}
          enterKeyHint="send"
          placeholder="Describe a map..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="flex-1 bg-transparent text-base sm:text-sm text-foreground outline-none disabled:opacity-50 resize-none max-h-32 leading-relaxed placeholder:text-muted-foreground"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="bg-primary text-primary-foreground rounded-full p-1.5 hover:bg-primary/90 transition-colors shrink-0"
            aria-label="Stop generation"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-primary text-primary-foreground rounded-full p-1.5 hover:bg-primary/90 transition-colors disabled:opacity-30 shrink-0"
            aria-label="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        )}
      </form>
    </>
  );
}
