import { Feather, Ionicons } from "@expo/vector-icons";
import { fetch as expoFetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { CHAT_URL } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

type BackendId = "anthropic" | "openai";

const SUGGESTIONS = [
  "Hospice market share in Texas?",
  "Hospital opportunities in Miami, FL",
  "Top SNFs in California",
  "Top Medicare Part D drugs by spending",
  "Find Amedisys providers in Texas",
  "Top Eliquis prescribers in Florida",
];

const BACKENDS: { id: BackendId; label: string; model: string }[] = [
  { id: "anthropic", label: "Claude", model: "claude-sonnet-4-6" },
  { id: "openai", label: "GPT-4o", model: "gpt-4o" },
];

function MessageBubble({ msg, colors }: { msg: Message; colors: ReturnType<typeof useColors> }) {
  const isUser = msg.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {msg.content || "▋"}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backend, setBackend] = useState<BackendId>("anthropic");
  const listRef = useRef<FlatList>(null);

  const activeBackend = BACKENDS.find((b) => b.id === backend) ?? BACKENDS[0];

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const id = Date.now().toString();
    const userMsg: Message = { role: "user", content: text, id: `u-${id}` };
    const assistantMsg: Message = { role: "assistant", content: "", id: `a-${id}` };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, assistantMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await expoFetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          backend,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const { text: chunk } = JSON.parse(data) as { text: string };
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = { ...last, content: last.content + chunk };
              return updated;
            });
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: Message }) => (
    <MessageBubble msg={item} colors={colors} />
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + "18" }]}>
          <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Medicare AI</Text>
        <Pressable
          style={[styles.backendPill, { backgroundColor: colors.muted, borderRadius: 20 }]}
          onPress={() => setBackend(backend === "anthropic" ? "openai" : "anthropic")}
        >
          <Text style={[styles.backendLabel, { color: colors.mutedForeground }]}>{activeBackend.label}</Text>
        </Pressable>
      </View>

      {messages.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="sparkles-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Ask anything</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Live CMS data · hospice markets, hospitals, drugs, providers
          </Text>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [
                  styles.suggestion,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => sendMessage(s)}
              >
                <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListFooterComponent={loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
        />
      )}

      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: bottomPad + 80 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about hospice, hospitals, drugs…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={1000}
          editable={!loading}
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: input.trim() && !loading ? colors.primary : colors.muted, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Feather name="send" size={18} color={input.trim() && !loading ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  backendPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  backendLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
  },
  suggestions: {
    width: "100%",
    gap: 8,
  },
  suggestion: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  loadingRow: {
    alignItems: "center",
    padding: 12,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
});
