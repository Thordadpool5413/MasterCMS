"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface EnhancedFormGroupProps {
  label: string;
  error?: string;
  success?: string;
  helpText?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function EnhancedFormGroup({
  label,
  error,
  success,
  helpText,
  required,
  children,
  className,
}: EnhancedFormGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="text-sm font-semibold text-[hsl(var(--foreground))]">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <div className="relative">
        {children}
        {error && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
        {success && !error && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            {success}
          </div>
        )}
      </div>
      {helpText && !error && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {helpText}
        </p>
      )}
    </div>
  );
}
