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
import { StatCard } from "@/components/shared/ResultCard";
import { StatePickerModal } from "@/components/shared/StatePickerModal";
import { useColors } from "@/hooks/useColors";
import { useNetInfo } from "@/hooks/useNetInfo";
import { mcp } from "@/lib/api";

interface PrescriberRow {
  Prscrbr_Last_Org_Name?: string;
  Prscrbr_First_Name?: string;
  Prscrbr_City?: string;
  Prscrbr_State_Abrvtn?: string;
  Prscrbr_Type?: string;
  Tot_Clms?: string | number;
  Tot_Benes?: string | number;
  Tot_Day_Suply?: string | number;
  Tot_Drug_Cst?: string | number;
  Brnd_Sprsn_Flag?: string;
}

interface PrescriberResult {
  rows: PrescriberRow[];
  total_records: number;
}

function fmt(v: string | number | undefined) {
  const n = Number(v ?? 0);
  return isNaN(n) ? "—" : n.toLocaleString("en-US");
}

function currency(v: string | number | undefined) {
  const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
  if (!n || isNaN(n)) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function PrescribersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetInfo();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [drugName, setDrugName] = useState("");
  const [state, setState] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriberResult | null>(null);

  async function handleSearch(isRefresh = false) {
    if (!drugName.trim()) { setError("Enter a drug name"); return; }
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const args: Record<string, unknown> = { drug_name: drugName, max_rows: 100 };
      if (state) args.state = state;
      if (specialty) args.specialty = specialty;
      const data = await mcp("prescribers_by_drug", args) as PrescriberResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const renderItem = ({ item }: { item: PrescriberRow }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {[item.Prscrbr_First_Name, item.Prscrbr_Last_Org_Name].filter(Boolean).join(" ") || "—"}
          </Text>
          <Text style={[styles.specialty, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.Prscrbr_Type ?? "—"}
          </Text>
        </View>
        <Text style={[styles.city, { color: colors.mutedForeground }]}>
          {item.Prscrbr_City}, {item.Prscrbr_State_Abrvtn}
        </Text>
      </View>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{fmt(item.Tot_Clms)}</Text>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>claims</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{fmt(item.Tot_Benes)}</Text>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>patients</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{currency(item.Tot_Drug_Cst)}</Text>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>cost</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!isOnline && <OfflineBanner />}
      <View style={[styles.filterPanel, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
            value={drugName}
            onChangeText={setDrugName}
            placeholder="Drug name (required)"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.inputRow}>
          <StatePickerModal value={state} onChange={setState} />
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
            value={specialty}
            onChangeText={setSpecialty}
            placeholder="Specialty"
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
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      {result && !loading && (
        <View style={styles.statsRow}>
          <StatCard label="Results" value={result.rows.length} />
          <StatCard label="Total Records" value={fmt(result.total_records)} />
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching prescriber data…</Text>
        </View>
      )}

      {!loading && !result && !error && (
        <View style={styles.centered}>
          <Feather name="user-check" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search prescribers</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Enter a drug name to find top Part D prescribers by state or specialty</Text>
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
  filterPanel: { padding: 12, gap: 8, borderBottomWidth: 1 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
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
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  specialty: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  city: { fontSize: 12, fontFamily: "Inter_400Regular" },
  meta: { flexDirection: "row", gap: 20 },
  metaItem: { alignItems: "center" },
  metaValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  metaLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
