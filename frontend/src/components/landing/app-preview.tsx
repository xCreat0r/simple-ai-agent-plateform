import { Badge } from "@/components/ui/badge";
import { Bot, Library, Wrench, MessageSquare, Search, Globe, Database, FileText, Sparkles } from "lucide-react";

const demoAgents = [
  { name: "数据分析师", model: "deepseek-chat", tools: 3, knowledge: 2 },
  { name: "客服助手", model: "deepseek-chat", tools: 2, knowledge: 1 },
  { name: "写作助手", model: "deepseek-reasoner", tools: 1, knowledge: 0 },
];

const navItems = [
  { label: "Agent", icon: Bot, active: true },
  { label: "知识库", icon: Library, active: false },
  { label: "工具", icon: Wrench, active: false },
];

// 静态模拟聊天消息（仅用于演示，不可交互）
function DemoMessage({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-50">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1.5 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm text-neutral-900">
        {children}
      </div>
    </div>
  );
}

export function AppPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
      {/* 演示角标 */}
      <div className="absolute right-4 top-4 z-10">
        <Badge variant="outline" className="bg-white/90 backdrop-blur">演示界面 · 非可交互</Badge>
      </div>

      {/* 模拟浏览器窗口栏 */}
      <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-xs text-neutral-400 ring-1 ring-neutral-200">
          app.example.com
        </span>
      </div>

      <div className="flex">
        {/* 模拟侧边栏 */}
        <div className="hidden w-44 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 sm:flex">
          <div className="flex h-11 items-center gap-2 border-b border-neutral-200 px-3">
            <Bot className="h-4 w-4 text-neutral-700" />
            <span className="text-sm font-semibold text-neutral-900">AI Agent</span>
          </div>
          <div className="flex-1 space-y-1 p-2">
            {navItems.map(({ label, icon: Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium ${
                  active ? "bg-neutral-200 text-neutral-900" : "text-neutral-500"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            ))}
          </div>
          <div className="border-t border-neutral-200 p-2">
            <div className="truncate rounded-md px-3 py-2 text-xs text-neutral-400">管理员</div>
          </div>
        </div>

        {/* 模拟主内容区 */}
        <div className="min-w-0 flex-1">
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-neutral-900">Agent</span>
              <span className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">新建 Agent</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {demoAgents.map((agent) => (
                <div key={agent.name} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-neutral-500" />
                    <span className="truncate text-sm font-semibold text-neutral-900">{agent.name}</span>
                  </div>
                  <p className="mb-2 truncate text-xs text-neutral-500">模型: {agent.model}</p>
                  <div className="flex gap-1.5">
                    <Badge variant="secondary">{agent.tools} 工具</Badge>
                    <Badge variant="secondary">{agent.knowledge} 知识库</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 模拟对话区 */}
          <div className="space-y-3 border-t border-neutral-200 p-4">
            <DemoMessage role="user">帮我分析这个季度销售数据，找出增长最快的产品线</DemoMessage>
            <DemoMessage role="assistant">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <Search className="h-3.5 w-3.5" />
                已调用工具：网页搜索 · 知识库检索
              </div>
              <p>我检索了知识库中的销售文档，以下是本季度增长最快的产品线：</p>
              <ul className="list-inside list-disc space-y-0.5 text-sm">
                <li><strong>企业版 SaaS</strong> — 环比增长 45%</li>
                <li><strong>移动端 API</strong> — 环比增长 32%</li>
              </ul>
            </DemoMessage>
            <DemoMessage role="assistant">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <Globe className="h-3.5 w-3.5" />
                数据来源：销售文档.pdf（知识库）
              </div>
              <p>需要我生成一份详细的分析报告吗？</p>
            </DemoMessage>
            <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-400">
              <MessageSquare className="h-4 w-4" />
              输入消息，@ 工具调用 …
              <span className="ml-auto flex items-center gap-1 text-xs">
                <FileText className="h-3.5 w-3.5" />
                <Database className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
