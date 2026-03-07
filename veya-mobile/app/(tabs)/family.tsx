import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet } from "react-native";
import { getFamily } from "@/services/api";
import { colors } from "@/constants/colors";

export default function FamilyTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["family"],
    queryFn: getFamily,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  const family = data?.family;
  const members = data?.members ?? [];
  const spend = data?.totalMonthlySpend ?? 0;

  if (!family) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Create or join a family on the web app.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{family.name}</Text>
        <Text style={styles.invite}>Invite code: {family.inviteCode}</Text>
        <Text style={styles.spend}>${spend.toFixed(2)}/mo total</Text>
      </View>
      <Text style={styles.sectionTitle}>Members</Text>
      {members.map((m: { id: string; name: string | null; email: string }) => (
        <View key={m.id} style={styles.memberRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(m.name ?? m.email).charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.memberName}>{m.name ?? "No name"}</Text>
            <Text style={styles.memberEmail}>{m.email}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  muted: { color: colors.textSecondary },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  invite: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 8,
  },
  spend: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent + "40",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.accent,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  memberEmail: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
