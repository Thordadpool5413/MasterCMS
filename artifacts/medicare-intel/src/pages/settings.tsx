import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Settings, Key } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BackendConfig {
  id: string;
  label: string;
  description: string;
  requiredEnvVars: string[];
  available: boolean;
}

const ENV_DESCRIPTIONS: Record<string, string> = {
  ANTHROPIC_API_KEY: "Claude API key from console.anthropic.com",
  OPENAI_API_KEY: "OpenAI API key from platform.openai.com",
  CMS_MEDICARE_MCP_URL: "URL of the remote CMS Medicare MCP server",
  LOCAL_MCP_URL: "URL of the local TypeScript MCP server (default: http://localhost:3001)",
  CENSUS_API_KEY: "Free key from api.census.gov/data/key_signup.html — enables demographics on National Dashboard",
};

export default function SettingsPage() {
  const [backends, setBackends] = useState<BackendConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/backends")
      .then((r) => r.json())
      .then((d) => { setBackends(d.backends ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <Settings className="h-6 w-6 text-[hsl(var(--primary))]" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
            Backend configuration for AI Chat and data sources
          </p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-base font-semibold">AI Chat Backends</h2>
        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
        ) : (
          <div className="space-y-3">
            {backends.map((b) => (
              <Card key={b.id} className={b.available ? "border-green-500/30 bg-green-500/5" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {b.available ? (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                        )}
                        <CardTitle className="text-sm">{b.label}</CardTitle>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            b.available
                              ? "bg-green-100 text-green-700"
                              : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                          }`}
                        >
                          {b.available ? "Ready" : "Not configured"}
                        </span>
                      </div>
                      <CardDescription className="mt-1 ml-6">{b.description}</CardDescription>
                    </div>
                  </div>
                  {!b.available && b.requiredEnvVars.length > 0 && (
                    <div className="ml-6 mt-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] p-3">
                      <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                        Required env vars:
                      </p>
                      {b.requiredEnvVars.map((v) => (
                        <div key={v} className="mb-1 last:mb-0">
                          <div className="flex items-center gap-1.5">
                            <Key className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                            <code className="text-xs font-mono text-[hsl(var(--foreground))]">{v}</code>
                          </div>
                          {ENV_DESCRIPTIONS[v] && (
                            <p className="ml-4 mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                              {ENV_DESCRIPTIONS[v]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-base font-semibold">Data Sources</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                CMS Public APIs
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Always available</span>
              </CardTitle>
              <CardDescription>
                Hospice Market, Hospital Opportunity, Nursing Home, NPI Lookup, Drug Spending, and Prescribers pull live data from CMS public APIs — no key required.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                ProPublica Nonprofit Explorer
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Always available</span>
              </CardTitle>
              <CardDescription>
                Competitor Intelligence uses the ProPublica 990 API — no API key required.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                ClinicalTrials.gov &amp; OpenFDA
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Always available</span>
              </CardTitle>
              <CardDescription>
                Clinical Trials and FDA adverse events / drug labels are free public APIs — no key required.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Key className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                Census ACS Demographics
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">Requires free key</span>
              </CardTitle>
              <CardDescription>
                State-level population, 65+ count, and median income shown on the National Dashboard when a state is selected.
                Add <code className="font-mono text-xs">CENSUS_API_KEY</code> — free at api.census.gov/data/key_signup.html.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  );
}
