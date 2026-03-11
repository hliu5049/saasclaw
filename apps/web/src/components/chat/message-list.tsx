"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot, ChevronDown, ChevronRight,
  Wrench, CheckCircle2, Loader2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, ActiveTool } from "@/hooks/use-chat";

// ── Color palette ─────────────────────────────────────────────────────────────

const COLOR_BG = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-red-500",
  "bg-pink-500",  "bg-cyan-500",  "bg-yellow-500",  "bg-slate-500",  "bg-indigo-500",
] as const;
const COLOR_TEXT = COLOR_BG.map(c => c.replace("bg-", "text-")) as readonly string[];

// ── Markdown ──────────────────────────────────────────────────────────────────

/**
 * Renders Markdown with GFM inside a chat bubble.
 * Keeps code blocks readable on the dark background.
 */
function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs — no extra margin on last child
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        // Headings
        h1: ({ children }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-1.5 text-base font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
        // Inline code
        code: ({ children, className }) => {
          const isBlock = className?.startsWith("language-");
          return isBlock ? (
            <code className={cn("block w-full", className)}>{children}</code>
          ) : (
            <code className="rounded bg-gray-700 px-1 py-0.5 font-mono text-xs text-emerald-300">
              {children}
            </code>
          );
        },
        // Fenced code block wrapper
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-lg bg-gray-950 p-3 font-mono text-xs text-gray-200">
            {children}
          </pre>
        ),
        // Lists
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-gray-600 pl-3 italic text-gray-400">
            {children}
          </blockquote>
        ),
        // Table (GFM)
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-700 bg-gray-800 px-2 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-700 px-2 py-1">{children}</td>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
          >
            {children}
          </a>
        ),
        // Horizontal rule
        hr: () => <hr className="my-3 border-gray-700" />,
        // Strong / em
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em:     ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

// ── Thinking block ────────────────────────────────────────────────────────────

function ThinkingBlock({ text, live = false }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(live);

  return (
    <div className="mb-2.5 overflow-hidden rounded-lg border border-gray-700/50 bg-gray-800/50 text-xs">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-gray-400 hover:text-gray-200 transition-colors"
      >
        {open
          ? <ChevronDown  className="h-3 w-3 flex-shrink-0" />
          : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
        {live ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            思考中…
          </span>
        ) : (
          <span className="text-gray-500">查看思考过程</span>
        )}
      </button>
      {open && (
        <div className="border-t border-gray-700/50 px-3 pb-3 pt-2">
          <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed text-gray-400">
            {text}
            {live && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-[blink_1s_step-start_infinite] bg-gray-400 align-text-bottom" />
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Tool call card ────────────────────────────────────────────────────────────

interface ToolCallCardProps {
  tool: ActiveTool;
  /** When present the call is finished; show summary instead of spinner. */
  result?: string;
}

function ToolCallCard({ tool, result }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);
  const done = result !== undefined;

  return (
    <div
      className={cn(
        "my-1.5 rounded-lg border text-xs transition-colors",
        done
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-blue-500/20 bg-blue-500/5",
      )}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-blue-400" />
        )}
        <span className={cn("flex-1 font-mono font-medium", done ? "text-emerald-300" : "text-blue-300")}>
          {tool.name}
        </span>
        {(tool.input || result) && (
          open
            ? <ChevronDown  className="h-3 w-3 flex-shrink-0 text-gray-500" />
            : <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="border-t border-gray-700/30 px-3 pb-3 pt-2 space-y-2">
          {tool.input && Object.keys(tool.input).length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-gray-500 uppercase tracking-wide" style={{ fontSize: "10px" }}>
                输入
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-gray-900 px-2 py-1.5 text-gray-300">
                {JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <p className="mb-1 font-semibold text-gray-500 uppercase tracking-wide" style={{ fontSize: "10px" }}>
                结果摘要
              </p>
              <p className="text-gray-300 leading-relaxed">{result}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cursor blink ──────────────────────────────────────────────────────────────

function Cursor() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[1px] animate-[blink_0.8s_step-start_infinite] bg-current align-text-bottom"
    />
  );
}

// ── Agent avatar ──────────────────────────────────────────────────────────────

function AgentAvatar({ colorIdx }: { colorIdx: number }) {
  const bg   = COLOR_BG[colorIdx % COLOR_BG.length];
  const text = COLOR_TEXT[colorIdx % COLOR_TEXT.length];
  return (
    <div
      className={cn(
        "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
        bg,
        "bg-opacity-20",
      )}
    >
      <Bot className={cn("h-4 w-4", text)} />
    </div>
  );
}

// ── Waiting animation ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

// ── Public component props ────────────────────────────────────────────────────

export interface MessageListProps {
  messages: Message[];
  /** The SSE text fragments arriving right now. Empty string when not streaming. */
  streamingText: string;
  thinkingText: string;
  /** Tools currently running. */
  activeTools: ActiveTool[];
  /** If true the assistant is streaming (used to show waiting dots). */
  isStreaming: boolean;
  /** colorIdx from the agent record, drives the avatar colour. */
  agentColorIdx?: number;
  /** Ref to attach to the scroll-anchor div at the bottom. */
  bottomRef?: React.RefObject<HTMLDivElement | null>;
}

// ── MessageList ───────────────────────────────────────────────────────────────

export function MessageList({
  messages,
  streamingText,
  thinkingText,
  activeTools,
  isStreaming,
  agentColorIdx = 0,
  bottomRef,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-6">

      {/* Committed messages */}
      {messages.map(msg =>
        msg.role === "user"
          ? <UserMessage key={msg.id} msg={msg} />
          : <AssistantMessage key={msg.id} msg={msg} colorIdx={agentColorIdx} />,
      )}

      {/* Live streaming turn */}
      {isStreaming && (
        <div className="flex gap-3">
          <AgentAvatar colorIdx={agentColorIdx} />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Live thinking */}
            {thinkingText && <ThinkingBlock text={thinkingText} live />}

            {/* Live tool calls */}
            {activeTools.map(t => (
              <ToolCallCard key={t.id} tool={t} />
            ))}

            {/* Text bubble (or waiting dots) */}
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-2.5 text-sm text-gray-100">
              {streamingText ? (
                <div className="[&_p:last-child]:inline">
                  <Markdown>{streamingText}</Markdown>
                  <Cursor />
                </div>
              ) : (
                <TypingDots />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

// ── User message ──────────────────────────────────────────────────────────────

function UserMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[75%] flex-col items-end gap-1">
        <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white">
          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
        </div>
        <time className="px-1 text-[11px] text-gray-600">
          {msg.createdAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
    </div>
  );
}

// ── Assistant message ─────────────────────────────────────────────────────────

function AssistantMessage({ msg, colorIdx }: { msg: Message; colorIdx: number }) {
  return (
    <div className="flex gap-3">
      <AgentAvatar colorIdx={colorIdx} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Completed thinking block */}
        {msg.thinking && <ThinkingBlock text={msg.thinking} />}

        {/* Content bubble */}
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-2.5 text-sm text-gray-100">
          <Markdown>{msg.content}</Markdown>
        </div>

        <time className="px-1 text-[11px] text-gray-600">
          {msg.createdAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
    </div>
  );
}
