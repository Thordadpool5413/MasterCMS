import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
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

type ToolSection = {
  title: string;
  items: {
    route: string;
    icon: React.ReactNode;
    label: string;
    subtitle: string;
  }[];
};

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 16;
  const bottomPad = isWeb ? 34 + 84 : insets.bottom + 80;

  const sections: ToolSection[] = [
    {
      title: "Market Intelligence",
      items: [
        {
          route: "/tools/hospice",
          icon: <Ionicons name="heart-outline" size={20} color="#3b82f6" />,
          label: "Hospice Market Share",
          subtitle: "PAC utilization by state",
        },
        {
          route: "/tools/hospital",
          icon: <MaterialIcons name="local-hospital" size={20} color="#6366f1" />,
          label: "Hospital Opportunity",
          subtitle: "Referral scoring by DRG",
        },
        {
          route: "/tools/nursing-home",
          icon: <Ionicons name="bed-outline" size={20} color="#8b5cf6" />,
          label: "Nursing Home Opportunity",
          subtitle: "SNF scoring by beds & quality",
        },
        {
          route: "/tools/competitor",
          icon: <Feather name="bar-chart-2" size={20} color="#ef4444" />,
          label: "Competitor Intelligence",
          subtitle: "IRS Form 990 financials",
        },
      ],
    },
    {
      title: "Provider Search",
      items: [
        {
          route: "/tools/npi",
          icon: <Feather name="search" size={20} color="#0ea5e9" />,
          label: "NPI Provider Lookup",
          subtitle: "NPPES registry search",
        },
        {
          route: "/tools/prescribers",
          icon: <Ionicons name="medical-outline" size={20} color="#f59e0b" />,
          label: "Prescriber Data",
          subtitle: "Part D by drug, state, specialty",
        },
      ],
    },
    {
      title: "Drug & Clinical Data",
      items: [
        {
          route: "/tools/drug-spending",
          icon: <MaterialIcons name="attach-money" size={20} color="#10b981" />,
          label: "Drug Spending",
          subtitle: "Part D/B spending trends",
        },
        {
          route: "/tools/clinical-trials",
          icon: <Ionicons name="flask-outline" size={20} color="#14b8a6" />,
          label: "Clinical Trials",
          subtitle: "ClinicalTrials.gov v2 API",
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>Data Tools</Text>
      <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Live CMS, NPPES, ProPublica & ClinicalTrials.gov</Text>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title.toUpperCase()}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {section.items.map((item, idx) => (
              <React.Fragment key={item.route}>
                <Pressable
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={[styles.rowIcon, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                    {item.icon}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
                {idx < section.items.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  pageSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionCard: {
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  divider: {
    height: 1,
    marginLeft: 64,
  },
});
