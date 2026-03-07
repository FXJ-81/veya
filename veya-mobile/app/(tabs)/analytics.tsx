import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { getAnalytics } from "@/services/api";
import { colors } from "@/constants/colors";

export default function AnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  const score = data?.score ?? 0;
  const yearly = data?.yearlyProjection ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Subscription score</Text>
        <Text style={styles.scoreValue}>{score}</Text>
        <Text style={styles.scoreHint}>Lower spend = higher score</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Yearly projection</Text>
        <Text style={styles.cardValue}>${yearly.toFixed(2)}</Text>
      </View>
      {data?.insights?.length ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>AI insights</Text>
          {data.insights.map((line: string, i: number) => (
            <Text key={i} style={styles.insight}>{line}</Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  muted: { color: colors.textSecondary },
  content: { padding: 16, paddingBottom: 32 },
  scoreCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: colors.accent,
    marginTop: 8,
  },
  scoreHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginTop: 4,
  },
  insight: {
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 8,
  },
});
