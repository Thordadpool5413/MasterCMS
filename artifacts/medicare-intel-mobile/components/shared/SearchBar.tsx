import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}

export function SearchBar({ placeholder, value, onChangeText, onSubmit, loading }: SearchBarProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
      <Feather name="search" size={16} color={colors.mutedForeground} />
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "Search…"}
        placeholderTextColor={colors.mutedForeground}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
      />
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Pressable onPress={onSubmit} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={[styles.btn, { color: colors.primary }]}>Go</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
