export interface AiRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  context?: ConversationContext;
}

export interface AiResponse {
  text: string;
  usage: TokenUsage;
  metadata: ResponseMetadata;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ResponseMetadata {
  provider: string;
  model: string;
  processingTime: number;
  cost?: number;
}

export interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
  }>;
  sessionId?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  costPerToken?: number;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface IAiProvider {
  id: string;
  name: string;
  generateText(request: AiRequest): Promise<AiResponse>;
  generateStream(request: AiRequest): AsyncIterable<AiResponse>;
  getModels(): Promise<ModelInfo[]>;
  validateConfig(config: ProviderConfig): boolean;
}