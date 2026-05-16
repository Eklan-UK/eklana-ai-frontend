"use client";

import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownTextProps {
  children: string;
  className?: string;
}

/** Body copy: works with `dark:` layouts even when `html` lacks `.dark` (CSS vars stay light). */
const MD_BODY = "text-gray-900 dark:text-[#e8ebe9]";
const MD_MUTED = "text-gray-600 dark:text-[#9aa39e]";

export function MarkdownText({ children, className = "" }: MarkdownTextProps) {
  // Sanitize the content before rendering
  // Note: react-markdown already escapes HTML by default (unless rehype-raw is used),
  // but explicitly using DOMPurify adds an extra layer of defense for the input string itself.
  // isomorphic-dompurify works on both server and client
  const sanitizedContent = DOMPurify.sanitize(children);

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize heading styles
          h1: ({ children }) => (
            <h1 className={`text-lg font-bold mt-4 mb-2 ${MD_BODY}`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-base font-bold mt-3 mb-2 ${MD_BODY}`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-sm font-semibold mt-2 mb-1 ${MD_BODY}`}>
              {children}
            </h3>
          ),
          // Paragraphs with proper spacing
          p: ({ children }) => (
            <p className={`text-sm leading-relaxed mb-2 last:mb-0 ${MD_BODY}`}>
              {children}
            </p>
          ),
          // Lists with proper spacing
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-2 ml-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-2 ml-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className={`text-sm leading-relaxed ${MD_BODY}`}>
              {children}
            </li>
          ),
          // Bold and italic
          strong: ({ children }) => (
            <strong className={`font-semibold ${MD_BODY}`}>{children}</strong>
          ),
          em: ({ children }) => (
            <em className={`italic ${MD_MUTED}`}>{children}</em>
          ),
          // Code blocks
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code
                className={`rounded px-1 py-0.5 text-xs font-mono bg-gray-100 dark:bg-[#232724] ${MD_BODY}`}
              >
                {children}
              </code>
            ) : (
              <code
                className={`block overflow-x-auto rounded p-2 text-xs font-mono bg-gray-100 dark:bg-[#232724] ${MD_BODY}`}
              >
                {children}
              </code>
            );
          },
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote
              className={`my-2 border-l-4 border-gray-200 pl-3 italic dark:border-[#3a3e3c] ${MD_MUTED}`}
            >
              {children}
            </blockquote>
          ),
          // Links
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-dark underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}

