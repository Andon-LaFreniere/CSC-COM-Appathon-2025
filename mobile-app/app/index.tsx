import React from "react";
import { SafeAreaView, View, Text, Pressable, StyleSheet, ScrollView, PressableProps } from "react-native";
import { useAuth } from "../context/AuthContext";
import { Link } from "expo-router";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

export default function Index() {
  const { currentPatientName } = useAuth();
  const patientName = currentPatientName ?? "Patient";
  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Pressable style={styles.patientHeader}>
            <Text style={styles.patientHeaderText}>{patientName}</Text>
          </Pressable>

          <View style={styles.gridContainer}>
            <Link href={"/questionnaire" as any} asChild>
              <TileButton
                icon={<MaterialCommunityIcons name="clipboard-list-outline" size={44} color="#ffffff" />}
              />
            </Link>
            <Link href={"/screening" as any} asChild>
              <TileButton
                icon={<MaterialCommunityIcons name="test-tube" size={44} color="#ffffff" />}
              />
            </Link>
            <Link href={"/medication" as any} asChild>
              <TileButton
                icon={<MaterialCommunityIcons name="bandage" size={44} color="#ffffff" />}
              />
            </Link>
            <Link href={"/risk" as any} asChild>
              <TileButton
                icon={<MaterialIcons name="warning-amber" size={44} color="#ffffff" />}
              />
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type TileButtonProps = PressableProps & { icon: React.ReactNode };

function TileButton({ icon, style, ...props }: TileButtonProps) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed, style as any]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  patientHeader: {
    backgroundColor: "#b50f2b", // deep red
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 64,
    // subtle card shadow
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  patientHeaderText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 28,
  },
  tile: {
    width: "46%",
    aspectRatio: 1,
    backgroundColor: "#b50f2b",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    // shadow for iOS
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 6 },
    // elevation for Android
    elevation: 8,
  },
  tilePressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
});
