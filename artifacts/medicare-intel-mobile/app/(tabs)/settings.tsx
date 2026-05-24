import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { mcp } from "@/lib/api";

type StatusItem = { label: string; ok: boolean; detail?: string };

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 16;
  const bottomPad = isWeb ? 34 + 84 : insets.bottom + 80;

  const [checking, setChecking] = useState(false);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);

  async function checkBackend() {
    setChecking(true);
    setStatuses([]);
    const items: StatusItem[] = [];
    try {
      await mcp("hospice_market_share_proxy", { state: "TX", max_rows: 1 });
      items.push({ label: "CMS Hospice API", ok: true });
    } catch (e: any) {
      items.push({ label: "CMS Hospice API", ok: false, detail: e?.message });
    }
    try {
      await mcp("lookup_npi", { last_name: "Smith", limit: 1 });
      items.push({ label: "NPPES NPI Registry", ok: true });
    } catch (e: any) {
      items.push({ label: "NPPES NPI Registry", ok: false, detail: e?.message });
    }
    try {
      await mcp("search_clinical_trials", { condition: "cancer", status: "RECRUITING", max_results: 1 });
      items.push({ label: "ClinicalTrials.gov", ok: true });
    } catch (e: any) {
      items.push({ label: "ClinicalTrials.gov", ok: false, detail: e?.message });
    }
    setStatuses(items);
    setChecking(false);
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "not set";

  const sources = [
    { icon: <MaterialIcons name="local-hospital" size={18} color={colors.primary} />, name: "CMS Medicare", url: "https://data.cms.gov" },
    { icon: <Feather name="search" size={18} color={colors.primary} />, name: "NPPES NPI Registry", url: "https://npiregistry.cms.hhs.gov" },
    { icon: <Ionicons name="flask-outline" size={18} color={colors.primary} />, name: "ClinicalTrials.gov", url: "https://clinicaltrials.gov" },
    { icon: <Feather name="file-text" size={18} color={colors.primary} />, name: "ProPublica 990 Data", url: "https://projects.propublica.org/nonprofits" },
    { icon: <Ionicons name="medical-outline" size={18} color={colors.primary} />, name: "FDA Drug Data", url: "https://open.fda.gov" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>Settings</Text>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BACKEND</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <View style={styles.row}>
          <Feather name="server" size={16} color={colors.mutedForeground} />
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>API Domain</Text>
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]} numberOfLines={1}>{domain}</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={{ padding: 14 }}>
          {checking ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : statuses.length > 0 ? (
            statuses.map((s) => (
              <View key={s.label} style={styles.statusRow}>
                <Feather name={s.ok ? "check-circle" : "x-circle"} size={14} color={s.ok ? colors.success : colors.destructive} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusLabel, { color: colors.foreground }]}>{s.label}</Text>
                  {s.detail && <Text style={[styles.statusDetail, { color: colors.mutedForeground }]}>{s.detail}</Text>}
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.checkHint, { color: colors.mutedForeground }]}>Tap below to verify data sources</Text>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.row}>
          <Text
            style={[styles.checkBtn, { color: colors.primary }]}
            onPress={checkBackend}
          >
            {checking ? "Checking…" : "Check Backend Status"}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>DATA SOURCES</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        {sources.map((s, idx) => (
          <React.Fragment key={s.name}>
            <View style={styles.sourceRow}>
              {s.icon}
              <Text style={[styles.sourceName, { color: colors.foreground }]}>{s.name}</Text>
              <Text style={[styles.sourceUrl, { color: colors.primary }]} onPress={() => Linking.openURL(s.url)}>
                Open
              </Text>
            </View>
            {idx < sources.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          </React.Fragment>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PRIVACY</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <View style={{ padding: 14 }}>
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            This app uses only public CMS, NPPES, ProPublica, FDA, and ClinicalTrials.gov data. No PHI (Protected Health Information) is collected, stored, or transmitted.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  rowValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    maxWidth: 160,
  },
  divider: {
    height: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  statusDetail: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  checkHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  checkBtn: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sourceName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sourceUrl: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  privacyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
});
