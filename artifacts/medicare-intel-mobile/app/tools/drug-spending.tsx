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

import { StatCard } from "@/components/shared/ResultCard";
import { useColors } from "@/hooks/useColors";
import { mcp } from "@/lib/api";

interface DrugRow {
  Brnd_Name?: string;
  Gnrc_Name?: string;
  Tot_Clms?: string | number;
  Tot_Spndng?: string | number;
  Tot_Benes?: string | number;
  Tot_Dsg_Unts?: string | number;
  Avg_Spnd_Per_Clm?: string | number;
}

interface DrugResult {
  rows: DrugRow[];
  total_records: number;
}

function currency(v: string | number | undefined) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmt(v: string | number | undefined) {
  const n = Number(v ?? 0);
  if (isNaN(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString("en-US");
}

export default function DrugSpendingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [drugName, setDrugName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DrugResult | null>(null);

  async function handleSearch() {
    if (!drugName.trim()) { setError("Enter a drug name to search"); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await mcp("drug_spending_by_manufacturer", { drug_name: drugName, max_rows: 100 }) as DrugResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const totalSpend = result?.rows.reduce((acc, r) => acc + parseFloat(String(r.Tot_Spndng ?? "0").replace(/,/g, "")), 0) ?? 0;
  const totalClaims = result?.rows.reduce((acc, r) => acc + Number(r.Tot_Clms ?? 0), 0) ?? 0;

  const renderItem = ({ item }: { item: DrugRow }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brandName, { color: colors.foreground }]}>{item.Brnd_Name ?? "—"}</Text>
          <Text style={[styles.genericName, { color: colors.mutedForeground }]}>{item.Gnrc_Name ?? ""}</Text>
        </View>
        <Text style={[styles.spending, { color: colors.primary }]}>{currency(item.Tot_Spndng)}</Text>
      </View>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{fmt(item.Tot_Clms)}</Text>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>claims</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{fmt(item.Tot_Benes)}</Text>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>benes</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{currency(item.Avg_Spnd_Per_Clm)}</Text>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>avg/claim</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
          value={drugName}
          onChangeText={setDrugName}
          placeholder="Drug name (e.g. Eliquis, Humira)"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
        />
        <Pressable
          style={({ pressed }) => [styles.searchBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
          onPress={handleSearch}
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
          <StatCard label="Records" value={result.rows.length} />
          <StatCard label="Total Spend" value={currency(totalSpend)} />
          <StatCard label="Total Claims" value={fmt(totalClaims)} />
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching drug spending…</Text>
        </View>
      )}

      {!loading && !result && !error && (
        <View style={styles.centered}>
          <Feather name="dollar-sign" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search drug spending</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Enter a brand or generic drug name to view Medicare Part D/B spending data</Text>
        </View>
      )}

      {!loading && result && (
        <FlatList
          data={result.rows}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1 },
  input: { fontSize: 14, fontFamily: "Inter_400Regular", paddingHorizontal: 12, paddingVertical: 10 },
  searchBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 8, padding: 12 },
  errorBox: { margin: 12, padding: 12, borderWidth: 1, borderRadius: 8 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  card: { borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  brandName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  genericName: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  spending: { fontSize: 18, fontFamily: "Inter_700Bold" },
  meta: { flexDirection: "row", gap: 16 },
  metaItem: { alignItems: "center" },
  metaValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  metaLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
