"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/national-dashboard", label: "National" },
  { href: "/chat", label: "AI Chat" },
  { href: "/hospice-market", label: "Hospice" },
  { href: "/hospital-opportunity", label: "Hospitals" },
  { href: "/nursing-home", label: "Nursing Homes" },
  { href: "/npi-lookup", label: "NPI Lookup" },
  { href: "/drug-spending", label: "Drug Spending" },
  { href: "/prescribers", label: "Prescribers" },
  { href: "/competitor-intel", label: "Competitor Intel" },
  { href: "/clinical-trials", label: "Clinical Trials" },
  // /settings is intentionally NOT in the user-facing nav. It exposes API-key /
  // backend configuration details meant for admins only; reach it via direct URL.
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[hsl(var(--primary))] shrink-0">
          <Activity className="h-5 w-5" />
          <span className="hidden sm:inline">CMS Intelligence</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-[hsl(var(--accent))]",
                pathname === link.href
                  ? "bg-[hsl(var(--accent))] font-medium text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
