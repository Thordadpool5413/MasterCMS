export type BackendId = "anthropic" | "openai" | "local-mcp";

export interface BackendConfig {
  id: BackendId;
  label: string;
  description: string;
  requiredEnvVars: string[];
  available: boolean;
}

export function getAvailableBackends(): BackendConfig[] {
  return [
    {
      id: "anthropic",
      label: "Anthropic (Claude) + CMS Direct",
      description: "Uses Claude with built-in CMS API tools. Fastest, no external dependencies.",
      requiredEnvVars: ["ANTHROPIC_API_KEY"],
      available: !!process.env.ANTHROPIC_API_KEY,
    },
    {
      id: "openai",
      label: "OpenAI + Remote CMS MCP",
      description: "Uses OpenAI models connected to a remote CMS Medicare MCP server.",
      requiredEnvVars: ["OPENAI_API_KEY", "CMS_MEDICARE_MCP_URL"],
      available: !!(process.env.OPENAI_API_KEY && process.env.CMS_MEDICARE_MCP_URL),
    },
    {
      id: "local-mcp",
      label: "Local TypeScript MCP Server",
      description: "Connects to the medicare-mcp TypeScript server running locally.",
      requiredEnvVars: ["LOCAL_MCP_URL"],
      available: !!process.env.LOCAL_MCP_URL,
    },
  ];
}

export function getDefaultBackend(): BackendId {
  const backends = getAvailableBackends();
  const available = backends.find((b) => b.available);
  return available?.id ?? "anthropic";
}
