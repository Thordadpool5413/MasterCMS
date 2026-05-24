import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function OfflineBanner() {
  const colors = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: colors.destructive }]}>
      <Feather name="wifi-off" size={13} color="#fff" />
      <Text style={styles.text}>You're offline — data may be outdated</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
