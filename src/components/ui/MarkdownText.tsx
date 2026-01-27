"use client";

import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownTextProps {
  children: string;
  className?: string;
}

export function MarkdownText({ children, className = "" }: MarkdownTextProps) {
  // Sanitize the content before rendering
  // Note: react-markdown already escapes HTML by default (unless rehype-raw is used),
  // but explicitly using DOMPurify adds an extra layer of defense for the input string itself.
  const sanitizedContent = typeof window !== 'undefined' 
    ? DOMPurify.sanitize(children) 
    : children; // On server-side, we trust react-markdown's default escaping or use a node-compatible sanitizer if needed

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Customize heading styles
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-gray-900 mt-3 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-gray-900 mt-2 mb-1">
              {children}
            </h3>
          ),
          // Paragraphs with proper spacing
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-gray-900 mb-2 last:mb-0">
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
            <li className="text-sm leading-relaxed text-gray-900">
              {children}
            </li>
          ),
          // Bold and italic
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-800">{children}</em>
          ),
          // Code blocks
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono text-gray-800">
                {children}
              </code>
            ) : (
              <code className="block bg-gray-100 p-2 rounded text-xs font-mono text-gray-800 overflow-x-auto">
                {children}
              </code>
            );
          },
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700 my-2">
              {children}
            </blockquote>
          ),
          // Links
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 underline"
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

