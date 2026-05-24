import { router } from "expo-router";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type ToolEntry = {
  route: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
};

function ToolCard({ entry }: { entry: ToolEntry }) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={() => router.push(entry.route as any)}
      testID={`tool-card-${entry.route}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: entry.accent + "22", borderRadius: colors.radius - 2 }]}>
        {entry.icon}
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{entry.title}</Text>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {entry.description}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 16;
  const bottomPad = isWeb ? 34 + 84 : insets.bottom + 80;

  const tools: ToolEntry[] = [
    {
      route: "/tools/hospice",
      icon: <Ionicons name="heart-outline" size={22} color="#3b82f6" />,
      title: "Hospice Market Share",
      description: "Medicare PAC utilization — beneficiary volume ranked by market share",
      accent: "#3b82f6",
    },
    {
      route: "/tools/hospital",
      icon: <MaterialIcons name="local-hospital" size={22} color="#6366f1" />,
      title: "Hospital Opportunity",
      description: "Medicare inpatient discharges scored by hospice referral opportunity",
      accent: "#6366f1",
    },
    {
      route: "/tools/nursing-home",
      icon: <Ionicons name="bed-outline" size={22} color="#8b5cf6" />,
      title: "Nursing Home Opportunity",
      description: "CMS-rated SNFs scored by hospice referral opportunity",
      accent: "#8b5cf6",
    },
    {
      route: "/tools/npi",
      icon: <Feather name="search" size={22} color="#0ea5e9" />,
      title: "NPI Provider Lookup",
      description: "Search the NPPES NPI registry by name, specialty, or location",
      accent: "#0ea5e9",
    },
    {
      route: "/tools/drug-spending",
      icon: <MaterialIcons name="attach-money" size={22} color="#10b981" />,
      title: "Drug Spending",
      description: "Medicare Part D and Part B spending trends with FDA data",
      accent: "#10b981",
    },
    {
      route: "/tools/prescribers",
      icon: <Ionicons name="medical-outline" size={22} color="#f59e0b" />,
      title: "Prescriber Data",
      description: "Medicare Part D prescribers by drug, state, or specialty",
      accent: "#f59e0b",
    },
    {
      route: "/tools/competitor",
      icon: <Feather name="bar-chart-2" size={22} color="#ef4444" />,
      title: "Competitor Intelligence",
      description: "IRS Form 990 filings for nonprofit hospice organizations",
      accent: "#ef4444",
    },
    {
      route: "/tools/clinical-trials",
      icon: <Ionicons name="flask-outline" size={22} color="#14b8a6" />,
      title: "Clinical Trials",
      description: "Active Medicare-relevant trials from ClinicalTrials.gov",
      accent: "#14b8a6",
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + "18", borderRadius: 16 }]}>
          <MaterialIcons name="insights" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Medicare Intel</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Live CMS public data — no PHI
        </Text>
      </View>

      <View style={[styles.chatBanner, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30", borderRadius: colors.radius }]}>
        <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
        <Text style={[styles.chatBannerText, { color: colors.primary }]}>Ask AI anything about hospice markets, hospitals, drugs, or providers</Text>
        <Pressable onPress={() => router.push("/chat" as any)}>
          <Feather name="arrow-right" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATA TOOLS</Text>

      {tools.map((entry) => (
        <ToolCard key={entry.route} entry={entry} />
      ))}

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        Data from CMS, ProPublica &amp; ClinicalTrials.gov
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  headerIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  chatBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  chatBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 4,
  },
});
