"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre: ({ children }) => (
          <pre className="my-2 p-3 rounded-lg bg-gray-900 text-gray-100 overflow-x-auto text-xs leading-relaxed">
            {children}
          </pre>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes("hljs") || className?.includes("language-");
          if (isBlock) {
            return <code className={className} {...props}>{children}</code>;
          }
          return (
            <code className="px-1 py-0.5 rounded bg-gray-200 text-xs font-mono" {...props}>
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300 text-xs">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-1.5 text-left font-medium border border-gray-300">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-1.5 border border-gray-300">{children}</td>
        ),
        ul: ({ children }) => <ul className="list-disc list-inside my-1 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside my-1 text-sm">{children}</ol>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-gray-300 pl-3 my-2 text-gray-500 text-sm italic">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-medium mt-2 mb-1">{children}</h3>,
        p: ({ children }) => <p className="my-1 text-sm">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        hr: () => <hr className="my-2 border-gray-200" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export const Markdown = MarkdownRenderer;
