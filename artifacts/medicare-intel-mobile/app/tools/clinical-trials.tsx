import { Feather, Ionicons } from "@expo/vector-icons";
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

import { Badge } from "@/components/shared/ResultCard";
import { StatePickerModal } from "@/components/shared/StatePickerModal";
import { useColors } from "@/hooks/useColors";
import { mcp } from "@/lib/api";

interface ClinicalTrial {
  nct_id: string;
  title: string;
  status: string;
  phase: string;
  conditions: string[];
  url: string;
  locations: Array<{ name?: string; city?: string; state?: string; country?: string }>;
  enrollment?: number;
  start_date?: string;
}

interface TrialsResult {
  trials: ClinicalTrial[];
  total_count: number;
}

const STATUS_OPTIONS = [
  { label: "Active", value: "RECRUITING,ACTIVE_NOT_RECRUITING,NOT_YET_RECRUITING" },
  { label: "Recruiting", value: "RECRUITING" },
  { label: "Completed", value: "COMPLETED" },
];

const CONDITION_PRESETS = ["Cancer", "COPD", "Heart Failure", "Dementia", "ALS", "Hospice", "Stroke"];

function statusVariant(status: string): "success" | "warning" | "default" {
  if (status === "RECRUITING") return "success";
  if (status === "ACTIVE NOT RECRUITING" || status === "NOT YET RECRUITING") return "warning";
  return "default";
}

export default function ClinicalTrialsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [condition, setCondition] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0].value);
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrialsResult | null>(null);

  async function handleSearch(cond?: string) {
    const c = cond ?? condition;
    if (!c.trim()) { setError("Enter a condition to search"); return; }
    setLoading(true);
    setError(null);
    try {
      const args: Record<string, unknown> = { condition: c, status: statusFilter, max_results: 20 };
      if (state) args.state = state;
      const data = await mcp("search_clinical_trials", args) as TrialsResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: ClinicalTrial }) => {
    const primaryLoc = item.locations[0];
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <View style={styles.cardHeader}>
          <Badge text={item.status} variant={statusVariant(item.status)} />
          {item.phase !== "N/A" && item.phase && (
            <View style={[styles.phasePill, { backgroundColor: colors.muted }]}>
              <Text style={[styles.phaseText, { color: colors.mutedForeground }]}>{item.phase}</Text>
            </View>
          )}
          <Pressable onPress={() => Linking.openURL(item.url)} style={{ marginLeft: "auto" as any }}>
            <Text style={[styles.nctId, { color: colors.primary }]}>{item.nct_id}</Text>
          </Pressable>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={3}>{item.title}</Text>

        {item.conditions.length > 0 && (
          <View style={styles.conditions}>
            {item.conditions.slice(0, 3).map((c) => (
              <View key={c} style={[styles.conditionChip, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[styles.conditionText, { color: colors.primary }]}>{c}</Text>
              </View>
            ))}
            {item.conditions.length > 3 && (
              <Text style={[styles.moreConditions, { color: colors.mutedForeground }]}>+{item.conditions.length - 3}</Text>
            )}
          </View>
        )}

        <View style={styles.cardFooter}>
          {primaryLoc && (
            <View style={styles.location}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {[primaryLoc.city, primaryLoc.state].filter(Boolean).join(", ")}
              </Text>
            </View>
          )}
          {item.enrollment && (
            <View style={styles.location}>
              <Ionicons name="people-outline" size={11} color={colors.mutedForeground} />
              <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{item.enrollment}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.filterPanel, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
            value={condition}
            onChangeText={setCondition}
            placeholder="Condition (e.g. Cancer, COPD)"
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
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.statusBtn, {
                backgroundColor: statusFilter === opt.value ? colors.primary : colors.muted,
                borderRadius: colors.radius,
              }]}
              onPress={() => setStatusFilter(opt.value)}
            >
              <Text style={[styles.statusText, { color: statusFilter === opt.value ? colors.primaryForeground : colors.mutedForeground }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
          <StatePickerModal value={state} onChange={setState} />
        </View>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      {!loading && !result && !error && (
        <>
          <View style={styles.centered}>
            <Ionicons name="flask-outline" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search clinical trials</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Medicare-relevant trials from ClinicalTrials.gov</Text>
          </View>
          <View style={styles.presets}>
            {CONDITION_PRESETS.map((c) => (
              <Pressable
                key={c}
                style={({ pressed }) => [styles.chip, { backgroundColor: colors.muted, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { setCondition(c); handleSearch(c); }}
              >
                <Text style={[styles.chipText, { color: colors.foreground }]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Searching trials…</Text>
        </View>
      )}

      {!loading && result && (
        <FlatList
          data={result.trials}
          keyExtractor={(item) => item.nct_id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
              {result.total_count} total · showing {result.trials.length}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterPanel: { padding: 12, gap: 8, borderBottomWidth: 1 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  statusRow: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: { fontSize: 14, fontFamily: "Inter_400Regular", paddingHorizontal: 12, paddingVertical: 10 },
  searchBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  errorBox: { margin: 12, padding: 12, borderWidth: 1, borderRadius: 8 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  centered: { alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  card: { borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  phasePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  phaseText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  nctId: { fontSize: 12, fontFamily: "Inter_500Medium" },
  title: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18, marginBottom: 8 },
  conditions: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  conditionChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  conditionText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  moreConditions: { fontSize: 11, fontFamily: "Inter_400Regular", alignSelf: "center" },
  cardFooter: { flexDirection: "row", gap: 16 },
  location: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
