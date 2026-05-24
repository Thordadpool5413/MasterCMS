import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: StatCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export function Badge({ text, variant = "default" }: { text: string; variant?: "default" | "success" | "warning" | "danger" }) {
  const colors = useColors();
  const bg = variant === "success" ? colors.successBackground : variant === "warning" ? colors.warningBackground : variant === "danger" ? colors.destructive + "20" : colors.muted;
  const fg = variant === "success" ? colors.success : variant === "warning" ? colors.warning : variant === "danger" ? colors.destructive : colors.mutedForeground;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderRadius: 6 }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function ResultRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.resultValue, { color: colors.foreground, fontFamily: mono ? "Inter_400Regular" : "Inter_500Medium" }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    borderWidth: 1,
    padding: 12,
    minWidth: 80,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 12,
  },
  resultLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  resultValue: {
    fontSize: 13,
    flex: 1.2,
    textAlign: "right",
  },
});
