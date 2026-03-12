"use client";

import {
  useRef, useState, useCallback,
  type KeyboardEvent, type ClipboardEvent, type ChangeEvent,
} from "react";
import { Send, Loader2, Paperclip, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Paste-image preview ───────────────────────────────────────────────────────

interface PastedImage {
  id: string;
  file: File;
  dataUrl: string;
}

// Generate a random ID compatible with all browsers
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function ImagePreview({
  image,
  onRemove,
}: {
  image: PastedImage;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.dataUrl}
        alt={image.file.name}
        className="h-16 w-16 rounded-lg border border-gray-700 object-cover"
      />
      <button
        type="button"
        onClick={() => onRemove(image.id)}
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-gray-400 hover:text-white"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface InputBarProps {
  onSend: (text: string, images?: File[]) => Promise<void> | void;
  isStreaming: boolean;
  /** Optional placeholder override. */
  placeholder?: string;
  /** Max textarea height in px before it scrolls. Default: 200 */
  maxHeight?: number;
  className?: string;
}

// ── InputBar ──────────────────────────────────────────────────────────────────

export function InputBar({
  onSend,
  isStreaming,
  placeholder = "输入消息… (Enter 发送，Shift+Enter 换行)",
  maxHeight = 200,
  className,
}: InputBarProps) {
  const [text,   setText]   = useState("");
  const [images, setImages] = useState<PastedImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-resize textarea ────────────────────────────────────────────────────

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, [maxHeight]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    resize();
  };

  // ── Send ────────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && images.length === 0) || isStreaming) return;

    setText("");
    setImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await onSend(trimmed, images.map(i => i.file));
    textareaRef.current?.focus();
  }, [text, images, isStreaming, onSend]);

  // ── Keyboard ─────────────────────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Paste images ─────────────────────────────────────────────────────────

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;

    e.preventDefault(); // Don't paste image as broken text

    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        setImages(prev => [
          ...prev,
          { id: generateId(), file, dataUrl },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) =>
    setImages(prev => prev.filter(i => i.id !== id));

  // ── Derived ───────────────────────────────────────────────────────────────

  const canSend = (text.trim().length > 0 || images.length > 0) && !isStreaming;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={cn("flex flex-col gap-2", className)}>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {images.map(img => (
            <ImagePreview key={img.id} image={img} onRemove={removeImage} />
          ))}
        </div>
      )}

      {/* Thinking status */}
      {isStreaming && (
        <div className="flex items-center gap-2 px-1 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Agent 正在思考…</span>
        </div>
      )}

      {/* Input row */}
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border bg-gray-800 px-3 py-2 transition-colors",
          isStreaming
            ? "border-gray-700 opacity-80"
            : "border-gray-700 focus-within:border-blue-500/60",
        )}
      >
        {/* Attachment hint (future extension) */}
        <button
          type="button"
          disabled={isStreaming}
          title="粘贴图片（Ctrl+V）"
          className="mb-0.5 flex-shrink-0 rounded p-1 text-gray-600 hover:text-gray-300 disabled:pointer-events-none"
          onClick={() => textareaRef.current?.focus()}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isStreaming ? "Agent 正在思考…" : placeholder}
          rows={1}
          disabled={isStreaming}
          className={cn(
            "flex-1 resize-none overflow-hidden bg-transparent text-sm text-gray-100",
            "placeholder:text-gray-600 focus:outline-none",
            "disabled:cursor-not-allowed",
            `max-h-[${maxHeight}px]`,
          )}
          style={{ maxHeight }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all",
            canSend
              ? "bg-blue-600 text-white hover:bg-blue-500 active:scale-95"
              : "bg-gray-700 text-gray-600",
          )}
        >
          {isStreaming
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>

      <p className="text-right text-[11px] text-gray-700 px-1">
        Shift+Enter 换行 · 可粘贴图片
      </p>
    </div>
  );
}
