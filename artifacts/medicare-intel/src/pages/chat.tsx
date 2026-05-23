"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { BackendId } from "@/lib/backend-config";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What's the hospice market share in Texas?",
  "Show me hospital opportunities in Miami, FL",
  "Top nursing homes in California by opportunity score",
  "Top Medicare Part D drugs by spending in 2023",
  "Find hospice providers named Amedisys in Texas",
  "Who are the top prescribers of Eliquis in Florida?",
];

const BACKENDS: { id: BackendId; label: string; model: string }[] = [
  { id: "anthropic", label: "Claude (Anthropic)", model: "claude-sonnet-4-6" },
  { id: "openai", label: "GPT-4o (OpenAI)", model: "gpt-4o" },
  { id: "local-mcp", label: "Local MCP Server", model: "local" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backend, setBackend] = useState<BackendId>("anthropic");
  const [showBackendPicker, setShowBackendPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowBackendPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          backend,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const { text } = JSON.parse(data) as { text: string };
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + text,
              };
              return updated;
            });
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        };
        return updated;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const activeBackend = BACKENDS.find((b) => b.id === backend) ?? BACKENDS[0];

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)]">
                <Bot className="h-7 w-7 text-[hsl(var(--primary))]" />
              </div>
              <h2 className="text-xl font-semibold">Medicare Market Intelligence</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Ask anything about hospice markets, hospital opportunities, drug spending, or providers
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 w-full max-w-2xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-lg border border-[hsl(var(--border))] px-4 py-3 text-left text-sm hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    msg.role === "assistant" ? "bg-[hsl(var(--primary)/0.1)]" : "bg-[hsl(var(--secondary))]",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="h-4 w-4 text-[hsl(var(--primary))]" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                    msg.role === "assistant"
                      ? "bg-[hsl(var(--card))] border border-[hsl(var(--border))]"
                      : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{msg.content || "▋"}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
        <div className="mx-auto max-w-3xl flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about hospice markets, hospitals, nursing homes, drug spending, or providers…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-[hsl(var(--input))] bg-transparent px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50 max-h-40 overflow-y-auto"
            style={{ minHeight: "48px" }}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            size="icon"
            className="h-12 w-12 shrink-0 rounded-xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="mx-auto max-w-3xl mt-2 flex items-center justify-between">
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowBackendPicker((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
            >
              <span>{activeBackend.label}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {showBackendPicker && (
              <div className="absolute bottom-full mb-1 left-0 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg p-1 min-w-52 z-50">
                {BACKENDS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setBackend(b.id); setShowBackendPicker(false); }}
                    className={cn(
                      "w-full flex items-center justify-between rounded px-3 py-2 text-sm text-left hover:bg-[hsl(var(--accent))] transition-colors",
                      backend === b.id && "bg-[hsl(var(--accent))] font-medium",
                    )}
                  >
                    <span>{b.label}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{b.model}</span>
                  </button>
                ))}
                <div className="mt-1 px-3 py-1 text-xs text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))]">
                  Configure in Settings → Backend
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Live CMS public data · No PHI
          </p>
        </div>
      </div>
    </div>
  );
}
