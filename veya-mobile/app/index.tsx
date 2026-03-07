import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { colors } from "@/constants/colors";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(async () => {
      const token = await SecureStore.getItemAsync("veya_access_token");
      const seenOnboarding = await SecureStore.getItemAsync("veya_onboarding_done");
      if (!seenOnboarding) {
        router.replace("/onboarding");
      } else if (!token) {
        router.replace("/(auth)/sign-in");
      } else {
        router.replace("/(tabs)");
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.logoRing} />
      <Text style={styles.logo}>V</Text>
      <Text style={styles.tagline}>Your money. Your rules.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  logoRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.accent + "60",
  },
  logo: {
    fontSize: 64,
    fontWeight: "bold",
    color: colors.accent,
  },
  tagline: {
    marginTop: 24,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
