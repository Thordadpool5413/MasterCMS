import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { US_STATES } from "@/lib/states";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function StatePickerModal({ value, onChange }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const label = US_STATES.find((s) => s.value === value)?.label ?? "All States";
  const filtered = US_STATES.filter(
    (s) => !query || s.label.toLowerCase().includes(query.toLowerCase()) || s.value.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Pressable
        style={[styles.trigger, { backgroundColor: colors.muted, borderRadius: colors.radius }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.triggerText, { color: value ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Select State</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={[styles.searchWrap, { margin: 12 }]}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Filter states…"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.stateRow,
                  { borderBottomColor: colors.border, backgroundColor: pressed ? colors.muted : "transparent" },
                ]}
                onPress={() => { onChange(item.value); setOpen(false); setQuery(""); }}
              >
                <Text style={[styles.stateLabel, { color: colors.foreground }]}>{item.label}</Text>
                {item.value === value && <Feather name="check" size={16} color={colors.primary} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sheet: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  searchWrap: {},
  searchInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  stateLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
