import { Link } from "wouter";
import { Activity, Building2, HeartPulse, Search, DollarSign, Pill, Building, FlaskConical, LayoutDashboard, MessageSquare, Settings } from "lucide-react";

const cards = [
  { href: "/national-dashboard", icon: LayoutDashboard, title: "National Dashboard", description: "Hospital opportunity + hospice market overview with state filter and Census demographics." },
  { href: "/chat", icon: MessageSquare, title: "AI Chat", description: "Ask anything about hospice markets, hospital opportunities, drug spending, or providers." },
  { href: "/hospice-market", icon: HeartPulse, title: "Hospice Market Share", description: "Medicare PAC utilization — beneficiary volume ranked by market share." },
  { href: "/hospital-opportunity", icon: Building2, title: "Hospital Opportunity", description: "Medicare inpatient discharges scored by hospice referral opportunity." },
  { href: "/nursing-home", icon: Building2, title: "Nursing Home Opportunity", description: "CMS-rated SNFs scored by hospice referral opportunity." },
  { href: "/npi-lookup", icon: Search, title: "NPI Provider Lookup", description: "Search the NPPES NPI registry by name, specialty, or location." },
  { href: "/drug-spending", icon: DollarSign, title: "Drug Spending", description: "Medicare Part D and Part B spending trends with FDA adverse events and drug label data." },
  { href: "/prescribers", icon: Pill, title: "Prescriber Data", description: "Medicare Part D prescribers by drug, state, or specialty." },
  { href: "/competitor-intel", icon: Building, title: "Competitor Intelligence", description: "Search IRS Form 990 filings for any nonprofit hospice or home health organization." },
  { href: "/clinical-trials", icon: FlaskConical, title: "Clinical Trials", description: "Active Medicare-relevant trials from ClinicalTrials.gov." },
  { href: "/settings", icon: Settings, title: "Settings", description: "Configure AI chat backends and view data source status." },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="text-center mb-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/0.1)]">
          <Activity className="h-8 w-8 text-[hsl(var(--primary))]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Medicare Market Intelligence</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))] max-w-xl mx-auto">
          Live CMS public data — hospice market share, hospital &amp; nursing home opportunity scoring, drug spending, prescribers, NPI lookup, competitor 990s, and clinical trials.
        </p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">No PHI · All data from CMS, ProPublica, and ClinicalTrials.gov public APIs</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href}>
            <div className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 hover:border-[hsl(var(--primary)/0.4)] hover:shadow-md transition-all cursor-pointer h-full">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] group-hover:bg-[hsl(var(--primary)/0.15)] transition-colors">
                  <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
                <h2 className="font-semibold text-sm">{title}</h2>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
