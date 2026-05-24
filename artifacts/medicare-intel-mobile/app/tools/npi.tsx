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
import { Badge, ResultRow, StatCard } from "@/components/shared/ResultCard";
import { StatePickerModal } from "@/components/shared/StatePickerModal";
import { useColors } from "@/hooks/useColors";
import { useNetInfo } from "@/hooks/useNetInfo";
import { mcp } from "@/lib/api";

interface NpiProvider {
  number?: string;
  basic?: {
    first_name?: string; last_name?: string; organization_name?: string;
    credential?: string; gender?: string; status?: string;
    enumeration_date?: string; last_updated?: string;
  };
  addresses?: Array<{ address_purpose?: string; address_1?: string; city?: string; state?: string; postal_code?: string; telephone_number?: string }>;
  taxonomies?: Array<{ code?: string; desc?: string; primary?: boolean; license?: string }>;
}

interface NpiResult {
  result_count?: number;
  rows: NpiProvider[];
}

function getName(p: NpiProvider) {
  if (p.basic?.organization_name) return p.basic.organization_name;
  return [p.basic?.first_name, p.basic?.last_name].filter(Boolean).join(" ") || "—";
}

function getAddr(p: NpiProvider) {
  return p.addresses?.find((a) => a.address_purpose === "LOCATION") ?? p.addresses?.[0];
}

function getTaxonomy(p: NpiProvider) {
  return p.taxonomies?.find((t) => t.primary) ?? p.taxonomies?.[0];
}

export default function NpiScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetInfo();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 34 : insets.bottom + 16;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NpiResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleSearch(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setExpanded(null);
    }
    setError(null);
    try {
      const args: Record<string, unknown> = { limit: 20 };
      if (firstName) args.first_name = firstName;
      if (lastName) args.last_name = lastName;
      if (orgName) args.organization_name = orgName;
      if (state) args.state = state;
      if (city) args.city = city;
      if (specialty) args.taxonomy_description = specialty;
      const data = await mcp("lookup_npi", args) as NpiResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const renderItem = ({ item }: { item: NpiProvider }) => {
    const addr = getAddr(item);
    const tax = getTaxonomy(item);
    const isExpanded = expanded === item.number;
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.card, borderColor: isExpanded ? colors.primary : colors.border, borderRadius: colors.radius }]}
        onPress={() => setExpanded(isExpanded ? null : (item.number ?? null))}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{getName(item)}</Text>
            {item.basic?.credential && (
              <Text style={[styles.credential, { color: colors.mutedForeground }]}>{item.basic.credential}</Text>
            )}
          </View>
          <Badge
            text={item.basic?.status === "A" ? "Active" : (item.basic?.status ?? "—")}
            variant={item.basic?.status === "A" ? "success" : "default"}
          />
        </View>

        <Text style={[styles.taxonomy, { color: colors.mutedForeground }]} numberOfLines={1}>
          {tax?.desc ?? "No taxonomy"}
        </Text>

        {addr && (
          <Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={1}>
            {[addr.city, addr.state, addr.postal_code?.slice(0, 5)].filter(Boolean).join(", ")}
          </Text>
        )}

        {isExpanded && (
          <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
            <ResultRow label="NPI" value={item.number ?? "—"} mono />
            {addr?.telephone_number && <ResultRow label="Phone" value={addr.telephone_number} />}
            {addr?.address_1 && <ResultRow label="Address" value={addr.address_1} />}
            {tax?.license && <ResultRow label="License" value={tax.license} />}
            {item.basic?.enumeration_date && <ResultRow label="Enumerated" value={item.basic.enumeration_date} />}
            {item.basic?.last_updated && <ResultRow label="Updated" value={item.basic.last_updated} />}
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
      <View style={[styles.filterPanel, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colors.mutedForeground}
          />
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
        <TextInput
          style={[styles.input, styles.fullInput, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius }]}
          value={orgName}
          onChangeText={setOrgName}
          placeholder="Organization name"
          placeholderTextColor={colors.mutedForeground}
        />
        <View style={styles.inputRow}>
          <StatePickerModal value={state} onChange={setState} />
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius, flex: 1 }]}
            value={specialty}
            onChangeText={setSpecialty}
            placeholder="Specialty (e.g. Hospice)"
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
        <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
          {(result.result_count ?? 0).toLocaleString()} total — showing {result.rows.length}
        </Text>
      )}

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Searching NPI registry…</Text>
        </View>
      )}

      {!loading && !result && !error && (
        <View style={styles.centered}>
          <Feather name="users" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search providers</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Enter any combination of name, org, state, city, or specialty</Text>
        </View>
      )}

      {!loading && result && (
        <FlatList
          data={result.rows as NpiProvider[]}
          keyExtractor={(item, i) => item.number ?? String(i)}
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
  fullInput: { width: "100%" },
  searchBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  errorBox: { margin: 12, padding: 12, borderWidth: 1, borderRadius: 8 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 16, paddingVertical: 8 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  card: { borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 2 },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  credential: { fontSize: 11, fontFamily: "Inter_400Regular" },
  taxonomy: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  address: { fontSize: 12, fontFamily: "Inter_400Regular" },
  expandedSection: { borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
});
