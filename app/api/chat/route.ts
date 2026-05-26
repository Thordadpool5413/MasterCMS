import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  getHospiceMarketShare,
  getHospitalOpportunity,
  getNursingHomeOpportunity,
  lookupNpi,
  getDrugSpending,
  searchPrescribers,
} from "@/lib/cms-direct";
import type { BackendId } from "@/lib/backend-config";

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOL_DEFS = {
  hospice_market_share: {
    description: "Get hospice provider market share rankings from Medicare PAC utilization data. Filter by US state abbreviation (e.g. TX, CA).",
    properties: {
      state: { type: "string", description: "2-letter US state abbreviation (optional)" },
      max_rows: { type: "number", description: "Maximum rows to return (default 50)" },
    },
  },
  hospital_opportunity: {
    description: "Score hospitals by hospice referral opportunity using Medicare inpatient discharge data.",
    properties: {
      state: { type: "string", description: "2-letter US state abbreviation (optional)" },
      city: { type: "string", description: "City name (optional)" },
      max_rows: { type: "number", description: "Maximum rows to return (default 50)" },
    },
  },
  nursing_home_opportunity: {
    description: "Score nursing homes / SNFs by hospice opportunity using CMS provider data.",
    properties: {
      state: { type: "string", description: "2-letter US state abbreviation (optional)" },
      city: { type: "string", description: "City name (optional)" },
      max_rows: { type: "number", description: "Maximum rows to return (default 50)" },
    },
  },
  npi_lookup: {
    description: "Look up healthcare providers in the NPPES NPI registry.",
    properties: {
      first_name: { type: "string" },
      last_name: { type: "string" },
      organization_name: { type: "string" },
      state: { type: "string", description: "2-letter state abbreviation" },
      city: { type: "string" },
      taxonomy_description: { type: "string", description: "Specialty e.g. Hospice, Cardiology" },
      limit: { type: "number", description: "Max results (default 20)" },
    },
  },
  drug_spending: {
    description: "Get Medicare Part D or Part B drug spending data by drug name.",
    properties: {
      drug_name: { type: "string", description: "Brand or generic drug name (optional)" },
      spending_type: { type: "string", description: "part_d or part_b (default part_d)" },
      max_rows: { type: "number", description: "Maximum rows to return (default 50)" },
    },
  },
  prescriber_search: {
    description: "Search Medicare Part D prescribers by drug, state, or specialty.",
    properties: {
      drug_name: { type: "string", description: "Drug name to filter by (optional)" },
      state: { type: "string", description: "2-letter state abbreviation (optional)" },
      prescriber_type: { type: "string", description: "Specialty e.g. Internal Medicine (optional)" },
      max_rows: { type: "number", description: "Maximum rows to return (default 50)" },
    },
  },
};

const SYSTEM_PROMPT =
  "You are a Medicare market intelligence assistant. You help hospice organizations analyze market share, identify hospital and nursing home referral opportunities, look up providers, and analyze drug spending using live CMS public data. Be concise and actionable. When presenting data, summarize key findings rather than listing every row. Use markdown tables when showing ranked lists.";

// ─── Tool executor ────────────────────────────────────────────────────────────

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    let result: unknown;
    switch (name) {
      case "hospice_market_share":
        result = await getHospiceMarketShare(input.state as string | undefined, (input.max_rows as number) ?? 50);
        break;
      case "hospital_opportunity":
        result = await getHospitalOpportunity(input.state as string | undefined, input.city as string | undefined, (input.max_rows as number) ?? 50);
        break;
      case "nursing_home_opportunity":
        result = await getNursingHomeOpportunity(input.state as string | undefined, input.city as string | undefined, (input.max_rows as number) ?? 50);
        break;
      case "npi_lookup":
        result = await lookupNpi(input as Parameters<typeof lookupNpi>[0]);
        break;
      case "drug_spending":
        result = await getDrugSpending(input.drug_name as string | undefined, (input.spending_type as "part_d" | "part_b") ?? "part_d", (input.max_rows as number) ?? 50);
        break;
      case "prescriber_search":
        result = await searchPrescribers(input.drug_name as string | undefined, input.state as string | undefined, input.prescriber_type as string | undefined, (input.max_rows as number) ?? 50);
        break;
      default:
        return `Unknown tool: ${name}`;
    }
    return JSON.stringify(result);
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Anthropic backend ────────────────────────────────────────────────────────

async function streamAnthropic(
  messages: Anthropic.MessageParam[],
  send: (text: string) => void,
) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools: Anthropic.Tool[] = Object.entries(TOOL_DEFS).map(([name, def]) => ({
    name,
    description: def.description,
    input_schema: { type: "object" as const, properties: def.properties },
  }));

  const currentMessages = [...messages];
  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: currentMessages,
      tools,
    });

    for (const block of response.content) {
      if (block.type === "text") send(block.text);
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter((b) => b.type === "tool_use");
      currentMessages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        if (toolUse.type !== "tool_use") continue;
        send(`\n\n_Fetching ${toolUse.name.replace(/_/g, " ")}…_\n\n`);
        const result = await runTool(toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
      }
      currentMessages.push({ role: "user", content: toolResults });
      continue;
    }
    break;
  }
}

// ─── OpenAI backend ───────────────────────────────────────────────────────────

async function streamOpenAI(
  messages: { role: string; content: string }[],
  send: (text: string) => void,
) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const tools: OpenAI.ChatCompletionTool[] = Object.entries(TOOL_DEFS).map(([name, def]) => ({
    type: "function" as const,
    function: { name, description: def.description, parameters: { type: "object", properties: def.properties } },
  }));

  const currentMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  while (true) {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: currentMessages,
      tools,
      stream: false,
    });

    const choice = response.choices[0];
    const msg = choice.message;

    if (msg.content) send(msg.content);

    if (choice.finish_reason === "tool_calls" && msg.tool_calls) {
      currentMessages.push(msg);
      const toolResults: OpenAI.ChatCompletionToolMessageParam[] = [];
      for (const call of msg.tool_calls) {
        send(`\n\n_Fetching ${call.function.name.replace(/_/g, " ")}…_\n\n`);
        const input = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const result = await runTool(call.function.name, input);
        toolResults.push({ role: "tool", tool_call_id: call.id, content: result });
      }
      currentMessages.push(...toolResults);
      continue;
    }
    break;
  }
}

// ─── Local MCP backend ────────────────────────────────────────────────────────

async function streamLocalMcp(
  messages: { role: string; content: string }[],
  send: (text: string) => void,
) {
  const mcpUrl = process.env.LOCAL_MCP_URL ?? "http://localhost:3001";
  const res = await fetch(`${mcpUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system: SYSTEM_PROMPT }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Local MCP server error ${res.status}`);
  const data = (await res.json()) as { content?: string; response?: string };
  send(data.content ?? data.response ?? "No response from local MCP server.");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    messages: { role: string; content: string }[];
    backend?: BackendId;
  };
  const { messages, backend = "anthropic" } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data })}\n\n`));

      try {
        switch (backend) {
          case "openai":
            await streamOpenAI(messages, send);
            break;
          case "local-mcp":
            await streamLocalMcp(messages, send);
            break;
          default:
            await streamAnthropic(messages as Anthropic.MessageParam[], send);
        }
      } catch (err) {
        send(`\n\nError: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
