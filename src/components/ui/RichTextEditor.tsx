"use client";

import { useRef } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

/**
 * Rich Text Editor with auto-formatting for copy/paste
 * Supports markdown formatting
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter text...",
  className = "",
  rows = 10,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-format on paste
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text/plain");

    // Auto-formatting rules:
    // 1. Normalize line endings
    // 2. Clean up excessive whitespace
    // 3. Preserve existing markdown formatting
    let formatted = pastedText;

    // Clean up excessive whitespace
    formatted = formatted.replace(/\r\n/g, "\n"); // Normalize line endings
    formatted = formatted.replace(/\r/g, "\n");
    formatted = formatted.replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines

    // Get cursor position
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.substring(0, start);
    const after = value.substring(end);

    // Insert formatted text
    const newValue = before + formatted + after;
    onChange(newValue);

    // Set cursor position after inserted text
    setTimeout(() => {
      if (textarea) {
        const newCursorPos = start + formatted.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }
    }, 0);
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 resize-none font-mono text-sm"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Markdown supported. Paste formatted text for auto-formatting.</span>
        <span>{value.length} characters</span>
      </div>
    </div>
  );
}

