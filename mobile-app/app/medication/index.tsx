import React from "react";
import { SafeAreaView, View, Text, StyleSheet, Pressable } from "react-native";
import { Link } from "expo-router";

export default function MedicationScreen() {
  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Medication</Text>
        <Text style={styles.subtitle}>List and manage medications here.</Text>
        <Link href="/medication/impact" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>View Medication Impact</Text>
          </Pressable>
        </Link>
        <Link href="/medication/log" asChild>
          <Pressable style={styles.buttonSecondary}>
            <Text style={styles.buttonText}>Medication Log (CSV)</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
  },
  button: {
    marginTop: 16,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  buttonSecondary: {
    marginTop: 12,
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});


