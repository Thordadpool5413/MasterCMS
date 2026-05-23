import { NextResponse } from "next/server";
import { getAvailableBackends } from "@/lib/backend-config";

export async function GET() {
  return NextResponse.json({ backends: getAvailableBackends() });
}
