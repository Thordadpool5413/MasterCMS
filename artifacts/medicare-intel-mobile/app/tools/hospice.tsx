import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, StatCard } from "@/components/shared/ResultCard";
import { StatePickerModal } from "@/components/shared/StatePickerModal";
import { useColors } from "@/hooks/useColors";
import { mcp } from "@/lib/api";

interface HospiceRow {
  _rank: number;
  _provider_name: string;
  _city: string;
  _state: string;
  _market: string;
  _market_volume: number;
  _market_total_volume: number;
  _market_share_pct: number;
  _payment?: number;
  _avg_age?: number;
}

interface HospiceResult {
  rows: HospiceRow[];
  total_volume: number;
  market_totals: Record<string, number>;
  interpretation_note: string;
}

function fmt(n: number) {
  return n?.toLocaleString("en-US") ?? "—";
}

function ShareBar({ pct, colors }: { pct: number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 60, height: 5, backgroundColor: colors.border, borderRadius: 3 }}>
        <View style={{ width: `${Math.min(pct * 3, 100)}%`, height: 5, backgroundColor: colors.primary, borderRadius: 3 }} />
      </View>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

export default function HospiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HospiceResult | null>(null);

  async function handleSearch() {
    if (!state) { setError("Please select a state first"); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await mcp("hospice_market_share_proxy", { state, max_rows: 200 }) as HospiceResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item, index }: { item: HospiceRow; index: number }) => (
    <View style={[styles.row, { borderBottomColor: colors.border, backgroundColor: index % 2 === 0 ? colors.background : colors.card }]}>
      <View style={styles.rankBadge}>
        <Text style={[styles.rankText, { color: colors.mutedForeground }]}>{item._rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.providerName, { color: colors.foreground }]} numberOfLines={1}>{item._provider_name || "—"}</Text>
        <Text style={[styles.location, { color: colors.mutedForeground }]}>{item._city}, {item._state}</Text>
        <ShareBar pct={item._market_share_pct} colors={colors} />
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.volume, { color: colors.foreground }]}>{fmt(item._market_volume)}</Text>
        <Text style={[styles.volumeLabel, { color: colors.mutedForeground }]}>benes</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <StatePickerModal value={state} onChange={setState} />
        </View>
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
        <View style={[styles.statsRow]}>
          <StatCard label="Providers" value={fmt(result.rows.length)} />
          <StatCard label="Total Benes" value={fmt(result.total_volume)} />
          <StatCard label="Markets" value={fmt(Object.keys(result.market_totals).length)} />
        </View>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching hospice data…</Text>
        </View>
      )}

      {!loading && !result && !error && (
        <View style={styles.centered}>
          <Feather name="map-pin" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Select a state</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Choose a state and tap Search to view hospice market share</Text>
        </View>
      )}

      {!loading && result && (
        <FlatList
          data={result.rows}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
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
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rankBadge: {
    width: 28,
    alignItems: "center",
  },
  rankText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  providerName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  location: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  volume: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  volumeLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
