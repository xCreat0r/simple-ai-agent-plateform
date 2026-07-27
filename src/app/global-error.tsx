"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center px-4">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">服务异常</h1>
            <p className="text-gray-500 mb-6">
              {error.message || "系统发生严重错误，请刷新页面。"}
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
            >
              刷新
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
