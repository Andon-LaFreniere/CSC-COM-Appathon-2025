import React from "react";
import { SafeAreaView, View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { useAuth } from "../../context/AuthContext";
import HumanWithDots, { SystemPoint } from "./HumanWithDots";

// Minimal mapping derived from visual_health_insight_app.py concepts
// Map medication name (lowercase) -> impacted body systems
const MED_TO_SYSTEMS: Record<string, string[]> = {
  "metformin": ["Endocrine", "Gastrointestinal"],
  "lisinopril": ["Cardiovascular", "Renal"],
  "atorvastatin": ["Cardiovascular", "Hepatic", "Musculoskeletal"],
};

// Map body system -> normalized position (x,y) in [0..1] coordinate space over a 0.45 aspect figure
const SYSTEM_TO_POS: Record<string, { x: number; y: number; color: string }> = {
  Cardiovascular: { x: 0.5, y: 0.28, color: "#ef4444" },
  Gastrointestinal: { x: 0.5, y: 0.5, color: "#f59e0b" },
  Hepatic: { x: 0.58, y: 0.42, color: "#f97316" },
  Renal: { x: 0.45, y: 0.58, color: "#22c55e" },
  Musculoskeletal: { x: 0.62, y: 0.22, color: "#3b82f6" },
  Endocrine: { x: 0.5, y: 0.18, color: "#a855f7" },
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export default function MedicationImpactScreen() {
  const { userId } = useAuth();
  const [medications, setMedications] = React.useState<string[]>([]);
  const [systems, setSystems] = React.useState<string[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (Platform.OS === "web") {
          const key = `medlog_${userId ?? "web"}`;
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
          const meds = extractMedsFromCsv(raw || "");
          if (isMounted) applyMeds(meds);
        } else {
          const SQLite = await import("expo-sqlite");
          const api: any = SQLite as any;
          const db = api.openDatabase ? api.openDatabase("app.db") : api.openDatabaseSync("app.db");
          db.readTransaction((tx: any) => {
            tx.executeSql(
              "SELECT medication FROM medications_log WHERE user_id = ? ORDER BY id ASC",
              [userId],
              (_tx: any, res: any) => {
                const rows = res?.rows?._array ?? [];
                const meds = rows.map((r: any) => String(r.medication || "")).filter(Boolean);
                if (isMounted) applyMeds(meds);
              }
            );
          });
        }
      } catch {
        if (isMounted) applyMeds([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  function extractMedsFromCsv(csvText: string): string[] {
    if (!csvText) return [];
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const meds: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const firstComma = lines[i].indexOf(",");
      const med = firstComma >= 0 ? lines[i].slice(0, firstComma) : lines[i];
      if (med.trim()) meds.push(med.trim());
    }
    return meds;
  }

  function applyMeds(meds: string[]) {
    setMedications(meds);
    const impacted = new Set<string>();
    for (const med of meds) {
      const mapped = MED_TO_SYSTEMS[normalizeName(med)];
      if (mapped) mapped.forEach((sys) => impacted.add(sys));
    }
    setSystems(Array.from(impacted));
  }

  const points: SystemPoint[] = systems
    .map((s) => SYSTEM_TO_POS[s])
    .filter(Boolean) as SystemPoint[];

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.title}>Medication Impact</Text>
          <Text style={styles.subtitle}>Visual overview of how your medications affect body systems.</Text>

          <View style={styles.bodyCard}>
            <View style={{ width: "100%", aspectRatio: 0.45 }}>
              <HumanWithDots points={points} />
            </View>
            <View style={styles.badgesWrap}>
              {systems.length === 0 ? (
                <Text style={styles.helper}>No known body system mappings for current medications.</Text>
              ) : (
                systems.map((s) => (
                  <View key={s} style={styles.badge}>
                    <Text style={styles.badgeText}>{s}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current medications</Text>
            {medications.length === 0 ? (
              <Text style={styles.helper}>No medications found. Add them in Medication Log.</Text>
            ) : (
              medications.map((m) => (
                <Text key={m} style={styles.itemText}>• {m}</Text>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mapped impacts</Text>
            {systems.length === 0 ? (
              <Text style={styles.helper}>No mappings available for these meds in the demo dataset.</Text>
            ) : (
              systems.map((s) => (
                <Text key={s} style={styles.itemText}>• {s}</Text>
              ))
            )}
          </View>
        </View>
      </ScrollView>
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
    gap: 16,
  },
  scroll: {
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  bodyCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    backgroundColor: "#b50f2b",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    color: "#fff",
    fontWeight: "700",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  itemText: {
    fontSize: 16,
  },
  helper: {
    color: "#666",
    fontSize: 14,
  },
});
