import Link from "next/link";
import {
  BarChart3,
  Building2,
  BedDouble,
  Search,
  MessageSquare,
  LayoutDashboard,
  DollarSign,
  Pill,
  Settings,
  Building,
  FlaskConical,
} from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const primarySections = [
  {
    href: "/hospice-market",
    title: "Hospice Market Share",
    description: "Ranked hospice providers by market share in any state, using Medicare PAC utilization data.",
    icon: BarChart3,
  },
  {
    href: "/hospital-opportunity",
    title: "Hospital Opportunity",
    description: "Score hospitals by hospice referral opportunity based on inpatient discharge volume.",
    icon: Building2,
  },
  {
    href: "/nursing-home",
    title: "Nursing Home Opportunity",
    description: "Identify SNF opportunities by state and city with scored provider rankings.",
    icon: BedDouble,
  },
  {
    href: "/npi-lookup",
    title: "NPI Provider Lookup",
    description: "Search the NPPES NPI registry by name, organization, specialty, state, or city.",
    icon: Search,
  },
];

const extendedSections = [
  {
    href: "/national-dashboard",
    title: "National Dashboard",
    description: "Side-by-side hospital opportunity and hospice market overview across any state.",
    icon: LayoutDashboard,
  },
  {
    href: "/drug-spending",
    title: "Drug Spending",
    description: "Medicare Part D and Part B drug spending trends — click any drug to see FDA adverse events and label data.",
    icon: DollarSign,
  },
  {
    href: "/prescribers",
    title: "Prescriber Data",
    description: "Medicare Part D prescribers ranked by drug, state, or specialty.",
    icon: Pill,
  },
  {
    href: "/competitor-intel",
    title: "Competitor Intelligence",
    description: "IRS Form 990 financials for any nonprofit hospice, home health, or palliative care org. Revenue, expenses, margin.",
    icon: Building,
  },
  {
    href: "/clinical-trials",
    title: "Clinical Trials",
    description: "Active Medicare-relevant trials from ClinicalTrials.gov — identify hospitals with high-acuity patient populations.",
    icon: FlaskConical,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Configure AI Chat backends: Claude (Anthropic), OpenAI, or local TypeScript MCP server.",
    icon: Settings,
  },
];

function SectionCard({
  href,
  title,
  description,
  icon: Icon,
  variant = "default",
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  variant?: "default" | "muted";
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${variant === "muted" ? "bg-[hsl(var(--muted))]" : "bg-blue-50"}`}>
            <Icon className={`h-5 w-5 ${variant === "muted" ? "text-[hsl(var(--muted-foreground))]" : "text-blue-600"}`} />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription className="mt-1">{description}</CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto">
        <Link
          href={href}
          className="inline-flex h-9 items-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          Open
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Medicare Market Intelligence</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          Hospice, hospital, drug, and prescriber intelligence — powered by free CMS public data. No subscriptions, no vendor lock-in.
        </p>
      </div>

      {/* AI Chat hero */}
      <div className="mb-6">
        <Card className="border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[hsl(var(--primary)/0.15)] p-2">
                <MessageSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
              </div>
              <CardTitle>AI Chat — Ask Anything</CardTitle>
            </div>
            <CardDescription>
              Ask Claude or GPT-4o about hospice markets, hospital opportunities, drug spending, nursing homes, or any provider — it pulls live CMS data to answer. Switch backends in the chat window.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link
              href="/chat"
              className="inline-flex h-9 items-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
            >
              Open Chat
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Primary tools */}
      <h2 className="mb-4 text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        Market Intelligence
      </h2>
      <div className="mb-8 grid gap-6 sm:grid-cols-2">
        {primarySections.map((section) => (
          <SectionCard key={section.href} {...section} />
        ))}
      </div>

      {/* Extended tools */}
      <h2 className="mb-4 text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        Extended Tools
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {extendedSections.map((section) => (
          <SectionCard key={section.href} {...section} variant="muted" />
        ))}
      </div>

      <div className="mt-8 rounded-lg bg-[hsl(var(--muted))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        <p className="font-medium text-[hsl(var(--foreground))]">Data Sources</p>
        <p className="mt-1">
          All data is sourced from free CMS public APIs: data.cms.gov, Provider Data Catalog, and the NPPES NPI Registry.
          No PHI. No patient-level data. Compliant public data only.
        </p>
      </div>
    </div>
  );
}
