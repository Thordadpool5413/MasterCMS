import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Badge, StatCard } from "@/components/shared/ResultCard";
import { StatePickerModal } from "@/components/shared/StatePickerModal";
import { useColors } from "@/hooks/useColors";
import { useNetInfo } from "@/hooks/useNetInfo";
import { mcp } from "@/lib/api";

interface HospitalRow {
  Rndrng_Prvdr_Org_Name?: string;
  Rndrng_Prvdr_City?: string;
  Rndrng_Prvdr_State_Abrvtn?: string;
  DRG_Cd?: string;
  DRG_Desc?: string;
  Tot_Dschrgs?: string | number;
  Avg_Tot_Pymt_Amt?: string | number;
  _opportunity_score: number;
  _matched_hospice_terms: string[];
}

function fmt(n: number | string | undefined) {
  const num = typeof n === "string" ? parseFloat(n.replace(/,/g, "")) : (n ?? 0);
  return isNaN(num) ? "—" : num.toLocaleString("en-US");
}

function ScorePill({ score, colors }: { score: number; colors: ReturnType<typeof useColors> }) {
  const variant = score > 500 ? "success" : score > 100 ? "warning" : "default";
  return <Badge text={fmt(score)} variant={variant} />;
}

export default function HospitalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetInfo();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: HospitalRow[]; total_records: number } | null>(null);

  async function handleSearch(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const args: Record<string, unknown> = { max_rows: 200 };
      if (state) args.state = state;
      if (city) args.city = city;
      const data = await mcp("hospital_hospice_opportunity", args) as { rows: HospitalRow[]; total_records: number; interpretation_note: string };
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const renderItem = ({ item }: { item: HospitalRow }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.hospitalName, { color: colors.foreground }]} numberOfLines={2}>
          {item.Rndrng_Prvdr_Org_Name ?? "—"}
        </Text>
        <ScorePill score={item._opportunity_score} colors={colors} />
      </View>
      <Text style={[styles.location, { color: colors.mutedForeground }]}>
        {item.Rndrng_Prvdr_City}, {item.Rndrng_Prvdr_State_Abrvtn}
      </Text>
      <Text style={[styles.drg, { color: colors.mutedForeground }]} numberOfLines={1}>
        DRG {item.DRG_Cd}: {item.DRG_Desc}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.footerItem, { color: colors.foreground }]}>
          {fmt(item.Tot_Dschrgs)} discharges
        </Text>
        {item._matched_hospice_terms.length > 0 && (
          <Badge text={item._matched_hospice_terms[0]} variant="success" />
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!isOnline && <OfflineBanner />}
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <StatePickerModal value={state} onChange={setState} />
        <TextInput
          style={[styles.cityInput, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius }]}
          value={city}
          onChangeText={setCity}
          placeholder="City (optional)"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          onSubmitEditing={() => handleSearch()}
        />
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

      {result && !loading && (
        <View style={styles.statsRow}>
          <StatCard label="Returned" value={fmt(result.rows.length)} />
          <StatCard label="Total Matched" value={fmt(result.total_records)} />
          <StatCard label="Top Score" value={fmt(result.rows[0]?._opportunity_score ?? 0)} />
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching hospital data…</Text>
        </View>
      )}

      {!loading && !result && !error && (
        <View style={styles.centered}>
          <Feather name="filter" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Filter and search</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Select a state or enter a city to score hospitals for hospice referrals</Text>
        </View>
      )}

      {!loading && result && (
        <FlatList
          data={result.rows}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => handleSearch(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    flexWrap: "wrap",
  },
  cityInput: {
    flex: 1,
    minWidth: 100,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  errorBox: {
    margin: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  card: { borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  hospitalName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  location: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  drg: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerItem: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
