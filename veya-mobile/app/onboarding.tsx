import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { colors } from "@/constants/colors";

const { width } = Dimensions.get("window");
const SLIDES = [
  { title: "Every subscription. One place.", emoji: "📋" },
  { title: "Cancel what you don't need.", emoji: "💰" },
  { title: "Meet your financial coach.", emoji: "🤖" },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const router = useRouter();

  const handleDone = async () => {
    await SecureStore.setItemAsync("veya_onboarding_done", "1");
    router.replace("/(auth)/sign-in");
  };

  return (
    <View style={styles.container}>
      <View style={styles.slide}>
        <Text style={styles.emoji}>{SLIDES[index].emoji}</Text>
        <Text style={styles.title}>{SLIDES[index].title}</Text>
      </View>
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>
      <Pressable style={styles.button} onPress={handleDone}>
        <Text style={styles.buttonText}>Get Started Free</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
