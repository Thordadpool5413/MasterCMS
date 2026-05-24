import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { StatePickerModal } from "@/components/shared/StatePickerModal";
import { useColors } from "@/hooks/useColors";
import { useNetInfo } from "@/hooks/useNetInfo";
import { mcp } from "@/lib/api";

interface NonprofitOrg {
  ein: string;
  name: string;
  city?: string;
  state?: string;
  ntee_code?: string;
  subsection_code?: string;
  filings?: NonprofitFiling[];
}

interface NonprofitFiling {
  tax_prd_yr: string;
  totrevenue: number;
  totexpns?: number;
  totnetassets?: number;
  pdf_url?: string;
}

interface NonprofitResult {
  organizations: NonprofitOrg[];
  total_results: number;
}

function currency(v: number) {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

function MiniSparkline({ filings, colors }: { filings: NonprofitFiling[]; colors: ReturnType<typeof useColors> }) {
  const sorted = [...filings].sort((a, b) => a.tax_prd_yr.localeCompare(b.tax_prd_yr)).slice(-5);
  if (sorted.length < 2) return null;
  const max = Math.max(...sorted.map((f) => f.totrevenue));
  if (!max) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 20 }}>
      {sorted.map((f) => (
        <View
          key={f.tax_prd_yr}
          style={{
            width: 8,
            height: Math.max(3, (f.totrevenue / max) * 20),
            backgroundColor: colors.primary + "80",
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}

const SUGGESTIONS = ["VITAS", "Amedisys", "Enhabit", "Crossroads Hospice", "Agrace", "Seasons Hospice"];

export default function CompetitorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetInfo();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NonprofitResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleSearch(q?: string, isRefresh = false) {
    const name = q ?? query;
    if (!name.trim()) { setError("Enter an organization name"); return; }
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setExpanded(null);
    }
    setError(null);
    try {
      const args: Record<string, unknown> = { name };
      if (state) args.state = state;
      const data = await mcp("search_nonprofits", args) as NonprofitResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const renderItem = ({ item }: { item: NonprofitOrg }) => {
    const isExpanded = expanded === item.ein;
    const latestFiling = item.filings?.sort((a, b) => b.tax_prd_yr.localeCompare(a.tax_prd_yr))[0];
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.card, borderColor: isExpanded ? colors.primary : colors.border, borderRadius: colors.radius }]}
        onPress={() => setExpanded(isExpanded ? null : item.ein)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.orgName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.location, { color: colors.mutedForeground }]}>
              {[item.city, item.state].filter(Boolean).join(", ")} · EIN {item.ein}
            </Text>
          </View>
          {item.filings && item.filings.length > 0 && (
            <MiniSparkline filings={item.filings} colors={colors} />
          )}
        </View>

        {latestFiling && (
          <View style={styles.revenueRow}>
            <Text style={[styles.revYear, { color: colors.mutedForeground }]}>{latestFiling.tax_prd_yr}</Text>
            <Text style={[styles.revAmount, { color: colors.primary }]}>{currency(latestFiling.totrevenue)}</Text>
            <Text style={[styles.revLabel, { color: colors.mutedForeground }]}>revenue</Text>
            {latestFiling.totexpns != null && latestFiling.totrevenue > 0 && (
              <Text style={[styles.margin, {
                color: latestFiling.totrevenue >= latestFiling.totexpns ? colors.success : colors.destructive
              }]}>
                {(((latestFiling.totrevenue - (latestFiling.totexpns ?? 0)) / latestFiling.totrevenue) * 100).toFixed(1)}% margin
              </Text>
            )}
          </View>
        )}

        {isExpanded && item.filings && (
          <View style={[styles.filingsTable, { borderTopColor: colors.border }]}>
            {item.filings.sort((a, b) => b.tax_prd_yr.localeCompare(a.tax_prd_yr)).map((f) => (
              <View key={f.tax_prd_yr} style={[styles.filingRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.filingYear, { color: colors.foreground }]}>{f.tax_prd_yr}</Text>
                <Text style={[styles.filingValue, { color: colors.primary }]}>{currency(f.totrevenue)}</Text>
                {f.totexpns != null && <Text style={[styles.filingValue, { color: colors.mutedForeground }]}>{currency(f.totexpns)}</Text>}
                {f.pdf_url && (
                  <Pressable onPress={() => Linking.openURL(f.pdf_url!)}>
                    <Feather name="file-text" size={14} color={colors.primary} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        <Feather
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.mutedForeground}
          style={{ alignSelf: "center", marginTop: 6 }}
        />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!isOnline && <OfflineBanner />}
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Organization name"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          onSubmitEditing={() => handleSearch()}
        />
        <StatePickerModal value={state} onChange={setState} />
        <Pressable
          style={({ pressed }) => [styles.searchBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
          onPress={() => handleSearch()}
          disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="search" size={16} color="#fff" />}
        </Pressable>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      {!loading && !result && !error && (
        <>
          <View style={styles.centered}>
            <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search nonprofit 990s</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>IRS Form 990 revenue data via ProPublica</Text>
          </View>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [styles.chip, { backgroundColor: colors.muted, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { setQuery(s); handleSearch(s); }}
              >
                <Text style={[styles.chipText, { color: colors.foreground }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Searching 990 filings…</Text>
        </View>
      )}

      {!loading && result && (
        <FlatList
          data={result.organizations}
          keyExtractor={(item) => item.ein}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => handleSearch(undefined, true)}
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
              {result.total_results} results
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, flexWrap: "wrap" },
  input: { fontSize: 14, fontFamily: "Inter_400Regular", paddingHorizontal: 12, paddingVertical: 10 },
  searchBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  errorBox: { margin: 12, padding: 12, borderWidth: 1, borderRadius: 8 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  centered: { alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  card: { borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  orgName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  location: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  revenueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  revYear: { fontSize: 12, fontFamily: "Inter_400Regular" },
  revAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  revLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  margin: { fontSize: 12, fontFamily: "Inter_500Medium", marginLeft: "auto" as any },
  filingsTable: { borderTopWidth: 1, marginTop: 10, paddingTop: 8 },
  filingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1 },
  filingYear: { width: 50, fontSize: 12, fontFamily: "Inter_500Medium" },
  filingValue: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
});
