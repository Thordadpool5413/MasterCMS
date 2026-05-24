import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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

interface NursingHomeRow {
  provname?: string;
  city?: string;
  state?: string;
  bedcert?: number | string;
  overall_rating?: number | string;
  health_ins_rating?: number | string;
  _opportunity_score?: number;
}

interface NursingHomeResult {
  rows: NursingHomeRow[];
  total_records: number;
}

function fmt(n: number | string | undefined) {
  const num = Number(n ?? 0);
  return isNaN(num) ? "—" : num.toLocaleString("en-US");
}

function RatingDots({ rating, colors }: { rating: number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i <= rating ? colors.primary : colors.border }} />
      ))}
    </View>
  );
}

export default function NursingHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetInfo();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [queryParams, setQueryParams] = useState<{ state: string; city: string } | null>(null);

  const { data: result, isLoading, isRefetching, error, refetch } = useQuery<NursingHomeResult>({
    queryKey: ["nursing-home", queryParams],
    queryFn: () => {
      const args: Record<string, unknown> = { max_rows: 200 };
      if (queryParams!.state) args.state = queryParams!.state;
      if (queryParams!.city) args.city = queryParams!.city;
      return mcp("nursing_home_opportunity", args) as Promise<NursingHomeResult>;
    },
    enabled: queryParams !== null,
  });

  function handleSearch() {
    setQueryParams({ state, city });
  }

  const renderItem = ({ item }: { item: NursingHomeRow }) => {
    const score = item._opportunity_score ?? 0;
    const variant = score > 500 ? "success" : score > 100 ? "warning" : "default";
    const rating = Number(item.overall_rating ?? 0);
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>{item.provname ?? "—"}</Text>
          <Badge text={fmt(score)} variant={variant} />
        </View>
        <Text style={[styles.location, { color: colors.mutedForeground }]}>{item.city}, {item.state}</Text>
        <View style={styles.meta}>
          <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>{fmt(item.bedcert)} beds</Text>
          {rating > 0 && <RatingDots rating={rating} colors={colors} />}
        </View>
      </View>
    );
  };

  const errorMsg = error instanceof Error ? error.message : error ? "Request failed" : null;

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
          onSubmitEditing={handleSearch}
        />
        <Pressable
          style={({ pressed }) => [styles.searchBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
          onPress={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="search" size={16} color="#fff" />}
        </Pressable>
      </View>

      {errorMsg && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
        </View>
      )}

      {result && !isLoading && (
        <View style={styles.statsRow}>
          <StatCard label="Returned" value={fmt(result.rows.length)} />
          <StatCard label="Total" value={fmt(result.total_records)} />
        </View>
      )}

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching nursing home data…</Text>
        </View>
      )}

      {!isLoading && !result && !errorMsg && (
        <View style={styles.centered}>
          <Feather name="map-pin" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Filter facilities</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Select state or city to score SNFs by hospice referral opportunity</Text>
        </View>
      )}

      {!isLoading && result && (
        <FlatList
          data={result.rows}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, flexWrap: "wrap" },
  cityInput: { flex: 1, minWidth: 100, fontSize: 14, fontFamily: "Inter_400Regular", paddingHorizontal: 12, paddingVertical: 10 },
  searchBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 8, padding: 12 },
  errorBox: { margin: 12, padding: 12, borderWidth: 1, borderRadius: 8 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  card: { borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  location: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaItem: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
