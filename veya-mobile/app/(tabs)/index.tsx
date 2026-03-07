import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { getSubscriptions, getDailyTip } from "@/services/api";
import { colors } from "@/constants/colors";

function useMonthlyTotal() {
  const { data: subs } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: getSubscriptions,
  });
  const active = subs?.filter((s: { status: string }) => s.status === "active") ?? [];
  const total = active.reduce((sum: number, s: { price: number; billingCycle: string }) => {
    const perMonth = s.billingCycle === "yearly" ? s.price / 12 : s.billingCycle === "weekly" ? s.price * 4.33 : s.price;
    return sum + perMonth;
  }, 0);
  return { total, subs: active };
}

export default function DashboardTab() {
  const { total, subs } = useMonthlyTotal();
  const { data: tipData } = useQuery({
    queryKey: ["daily-tip"],
    queryFn: getDailyTip,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Dashboard</Text>
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Monthly spend</Text>
        <Text style={styles.heroValue}>${total.toFixed(2)}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={styles.statValue}>{subs.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Yearly</Text>
          <Text style={styles.statValue}>${(total * 12).toFixed(0)}</Text>
        </View>
      </View>
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>Veya AI Tip</Text>
        <Text style={styles.tipText}>{tipData?.tip ?? "Add subscriptions to get personalized tips."}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 16,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.accent,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 4,
  },
  tipCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accent + "40",
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
});
