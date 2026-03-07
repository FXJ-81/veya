import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { getSubscriptions } from "@/services/api";
import { colors } from "@/constants/colors";

export default function SubscriptionsTab() {
  const { data: subs, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: getSubscriptions,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  const list = subs ?? [];
  if (list.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No subscriptions yet. Add them on the web app.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.price}>${item.price} / {item.billingCycle}</Text>
          <Text style={styles.meta}>{item.category} · {item.status}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  muted: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  price: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
});
