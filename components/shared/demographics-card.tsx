"use client";

import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, TrendingDown, Heart, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DemographicData } from "@/lib/census-acs";

function formatCurrency(value: number | null): string {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function DemographicsCard({ data }: { data: DemographicData | null }) {
  if (!data) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs ml-2">
            Census API key required. Visit{" "}
            <a
              href="https://api.census.gov/data/key_signup.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--primary))] hover:underline"
            >
              api.census.gov/data/key_signup.html
            </a>{" "}
            to register for a free API key, then add it to your environment variables.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Demographics & Economic Data
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--foreground))]">
            {data.geographyName}
          </p>
        </div>
        <Badge variant="secondary">2021 ACS</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-[hsl(var(--border))] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Population</dt>
          </div>
          <dd className="text-sm font-mono font-semibold">{formatNumber(data.population)}</dd>
        </div>

        <div className="rounded-md border border-[hsl(var(--border))] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Median Income</dt>
          </div>
          <dd className="text-sm font-mono font-semibold">{formatCurrency(data.medianHouseholdIncome)}</dd>
        </div>

        {data.povertyRate !== null && (
          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Poverty Rate</dt>
            </div>
            <dd className="text-sm font-mono font-semibold">{formatPercent(data.povertyRate)}</dd>
          </div>
        )}

        {data.uninsuredRate !== null && (
          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Heart className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              <dt className="text-xs text-[hsl(var(--muted-foreground))]">Uninsured</dt>
            </div>
            <dd className="text-sm font-mono font-semibold">{formatPercent(data.uninsuredRate)}</dd>
          </div>
        )}

        {data.medianAge !== null && (
          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Median Age</dt>
            <dd className="mt-0.5 text-sm font-mono font-semibold">{data.medianAge.toFixed(1)} years</dd>
          </div>
        )}

        {data.collegeEducationRate !== null && (
          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Bachelor's Degree+</dt>
            <dd className="mt-0.5 text-sm font-mono font-semibold">{formatPercent(data.collegeEducationRate)}</dd>
          </div>
        )}

        {data.unemploymentRate !== null && (
          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <dt className="text-xs text-[hsl(var(--muted-foreground))]">Unemployment</dt>
            <dd className="mt-0.5 text-sm font-mono font-semibold">{formatPercent(data.unemploymentRate)}</dd>
          </div>
        )}
      </div>

      {Object.values(data.raceEthnicity).some(v => v !== null) && (
        <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Race & Ethnicity</p>
          <div className="space-y-1 text-xs">
            {data.raceEthnicity.whitePercent !== null && (
              <div className="flex justify-between">
                <span>White</span>
                <span className="font-mono font-semibold">{formatPercent(data.raceEthnicity.whitePercent)}</span>
              </div>
            )}
            {data.raceEthnicity.hispanicPercent !== null && (
              <div className="flex justify-between">
                <span>Hispanic/Latino</span>
                <span className="font-mono font-semibold">{formatPercent(data.raceEthnicity.hispanicPercent)}</span>
              </div>
            )}
            {data.raceEthnicity.blackPercent !== null && (
              <div className="flex justify-between">
                <span>Black/African American</span>
                <span className="font-mono font-semibold">{formatPercent(data.raceEthnicity.blackPercent)}</span>
              </div>
            )}
            {data.raceEthnicity.asianPercent !== null && (
              <div className="flex justify-between">
                <span>Asian</span>
                <span className="font-mono font-semibold">{formatPercent(data.raceEthnicity.asianPercent)}</span>
              </div>
            )}
            {data.raceEthnicity.otherPercent !== null && (
              <div className="flex justify-between">
                <span>Other</span>
                <span className="font-mono font-semibold">{formatPercent(data.raceEthnicity.otherPercent)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Source: U.S. Census Bureau (ACS 5-year) • Updated {new Date(data.lastUpdated).toLocaleDateString()}
      </p>
    </div>
  );
}
