export interface Agent {
  id: string; userId: string; name: string; systemPrompt: string;
  model: string; temperature: number; maxTokens: number;
  tools?: string[]; knowledgeBaseIds?: string[];
  createdAt: string; updatedAt: string;
}

export interface Chat {
  id: string; agentId: string; title: string; createdAt: string;
}

export interface Message {
  id: string; chatId: string; role: "user" | "assistant" | "tool";
  content: string; toolCalls?: unknown; toolResult?: unknown; createdAt: string;
}

export interface Tool {
  id: string; name: string; description: string; builtin?: boolean;
  parameters: Record<string, unknown>; endpoint?: string; method?: string;
  headers?: Record<string, string>; createdAt?: string; updatedAt?: string;
}

export interface KnowledgeBase {
  id: string; userId: string; name: string; createdAt: string;
}

export interface Document {
  id: string; filename: string; createdAt: string; chunkCount: number;
  sizeBytes?: number; status?: string; error?: string;
}
