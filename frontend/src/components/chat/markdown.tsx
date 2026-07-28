import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-50 my-2">{children}</pre>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm font-mono">{children}</code>;
          }
          return <code className={className} {...props}>{children}</code>;
        },
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-7">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-6 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-6 mb-2">{children}</ol>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-neutral-300 pl-4 italic text-neutral-600 mb-2">{children}</blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
