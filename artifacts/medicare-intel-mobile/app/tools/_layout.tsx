import { Stack } from "expo-router";
import React from "react";
import { useColors } from "@/hooks/useColors";

export default function ToolsLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", color: colors.foreground },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="hospice" options={{ title: "Hospice Market Share" }} />
      <Stack.Screen name="hospital" options={{ title: "Hospital Opportunity" }} />
      <Stack.Screen name="nursing-home" options={{ title: "Nursing Home Opportunity" }} />
      <Stack.Screen name="npi" options={{ title: "NPI Provider Lookup" }} />
      <Stack.Screen name="drug-spending" options={{ title: "Drug Spending" }} />
      <Stack.Screen name="prescribers" options={{ title: "Prescriber Data" }} />
      <Stack.Screen name="competitor" options={{ title: "Competitor Intelligence" }} />
      <Stack.Screen name="clinical-trials" options={{ title: "Clinical Trials" }} />
    </Stack>
  );
}
