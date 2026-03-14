import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Paperclip, Trash2, Loader2, Bot, User } from "lucide-react"
import { toast } from "sonner"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

type Props = {
  agentId: string
  agentName: string
}

export function ChatPanel({ agentId, agentName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamingMsgIdRef = useRef<string | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await api.getChatHistory(agentId)
        if (res.success && res.data.messages.length > 0) {
          setMessages(
            res.data.messages.map((m: any, i: number) => ({
              id: `history-${i}`,
              role: m.role === "user" ? "user" : "assistant",
              content: typeof m.content === "string"
                ? m.content
                : Array.isArray(m.content)
                  ? m.content.map((b: any) => b.text ?? b.content ?? "").join("")
                  : JSON.stringify(m.content),
            }))
          )
        }
      } catch {
        // gateway offline — start fresh
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [agentId])

  // SSE connection
  useEffect(() => {
    const url = api.getStreamUrl(agentId)
    console.log("[ChatPanel] SSE connecting to:", url)
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => console.log("[ChatPanel] SSE connected")
    // Debug: log ALL incoming SSE messages
    es.onmessage = (e) => console.log("[ChatPanel] SSE onmessage:", e.data?.substring(0, 200))

    es.addEventListener("text", (e: MessageEvent) => {
      console.log("[ChatPanel] SSE text event:", e.data?.substring(0, 200))
      const data = JSON.parse(e.data)
      // Gateway "agent" events: { stream, data: { text (full), delta (chunk) } }
      // Gateway "chat" events:  { state: "delta", message: { text } | string }
      const nested = data.data as Record<string, unknown> | undefined
      const msg = data.message

      // Prefer delta (incremental chunk) for append mode
      const delta: string | undefined =
        data.delta ?? nested?.delta ?? data.content ?? undefined
      // Full accumulated text — used as replacement if no delta
      const fullText: string | undefined =
        nested?.text ?? data.text ??
        (typeof msg === "string" ? msg : msg?.text ?? msg?.content ?? undefined)

      const hasDelta = typeof delta === "string" && delta.length > 0
      const hasFull  = typeof fullText === "string" && fullText.length > 0
      if (!hasDelta && !hasFull) return

      // Assign ID outside the updater so StrictMode double-invocation is safe
      if (!streamingMsgIdRef.current) {
        streamingMsgIdRef.current = `stream-${Date.now()}`
      }
      const streamId = streamingMsgIdRef.current

      setMessages(prev => {
        const existing = prev.find(m => m.id === streamId)
        if (existing) {
          return prev.map(m => {
            if (m.id !== streamId) return m
            return hasDelta
              ? { ...m, content: m.content + delta }
              : { ...m, content: fullText! }
          })
        } else {
          const initial = hasDelta ? delta! : fullText!
          return [...prev, { id: streamId, role: "assistant", content: initial, isStreaming: true }]
        }
      })
    })

    es.addEventListener("done", () => {
      setIsStreaming(false)
      setMessages(prev =>
        prev.map(m =>
          m.id === streamingMsgIdRef.current ? { ...m, isStreaming: false } : m
        )
      )
      streamingMsgIdRef.current = null
    })

    es.onerror = (err) => {
      console.error("[ChatPanel] SSE error:", err, "readyState:", es.readyState)
    }

    return () => {
      es.close()
    }
  }, [agentId])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || isStreaming) return

    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: msg }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsStreaming(true)
    streamingMsgIdRef.current = null

    try {
      await api.sendMessage(agentId, msg)
    } catch (err: any) {
      setIsStreaming(false)
      toast.error(err.message || "Failed to send message")
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    setIsUploading(true)
    try {
      await api.uploadDocument(agentId, file)
      toast.success(`"${file.name}" added to knowledge base`)
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        role: "assistant",
        content: `📎 File "${file.name}" has been added to the knowledge base.`,
      }])
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  const handleClearSession = async () => {
    try {
      await api.clearSession(agentId)
      setMessages([])
      streamingMsgIdRef.current = null
      setIsStreaming(false)
      toast.success("Session cleared")
    } catch {
      toast.error("Failed to clear session")
    }
  }

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-[560px]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-zinc-50">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <Bot className="h-4 w-4 text-zinc-500" />
          <span>Chat with {agentName}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearSession}
          className="text-zinc-500 hover:text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
            Start a conversation with {agentName}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center mt-0.5">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                msg.role === "user"
                  ? "bg-zinc-900 text-white rounded-tr-sm"
                  : "bg-zinc-100 text-zinc-900 rounded-tl-sm"
              }`}
            >
              {msg.content}
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-zinc-400 animate-pulse rounded-sm align-middle" />
              )}
            </div>
            {msg.role === "user" && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center mt-0.5">
                <User className="h-3.5 w-3.5 text-zinc-600" />
              </div>
            )}
          </div>
        ))}
        {/* Typing indicator */}
        {isStreaming && streamingMsgIdRef.current === null && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center mt-0.5">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t bg-white p-3 space-y-2">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            className="flex-1 resize-none min-h-[44px] max-h-[120px] text-sm"
            rows={1}
            disabled={isStreaming}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.docx"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isStreaming}
            title="Upload file to knowledge base (PDF, DOCX, TXT, MD)"
          >
            {isUploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Paperclip className="h-4 w-4" />
            }
          </Button>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-zinc-400 pl-0.5">
          📎 Upload PDF, DOCX, TXT or MD to add files to the agent's knowledge base
        </p>
      </div>
    </div>
  )
}
