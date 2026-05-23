export type BackendId = "anthropic" | "openai" | "local-mcp";

export interface BackendConfig {
  id: BackendId;
  label: string;
  description: string;
  requiredEnvVars: string[];
  available: boolean;
}
