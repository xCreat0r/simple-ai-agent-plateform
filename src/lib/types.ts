export interface Agent {
  id: string;
  userId: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: string;
  maxTokens: number;
  tools?: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Chat {
  id: string;
  agentId: string;
  title: string;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: unknown;
  toolResult?: unknown;
  createdAt: string;
}

export interface ToolData {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}
