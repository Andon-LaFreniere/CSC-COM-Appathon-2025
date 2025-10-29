import React from "react";
import { SafeAreaView, View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";

type QuestionnaireData = {
  familyHistory: string;
  exerciseRoutines: string;
  dietaryHabits: string;
  medications: string;
};

const defaultData: QuestionnaireData = {
  familyHistory: "",
  exerciseRoutines: "",
  dietaryHabits: "",
  medications: "",
};

export default function QuestionnaireScreen() {
  const { userId, isAuthenticated } = useAuth();
  const [data, setData] = React.useState<QuestionnaireData>(defaultData);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState<boolean>(false);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (!isAuthenticated) return;
        if (Platform.OS === "web") {
          const key = `q_${userId ?? "web"}`;
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
          if (raw && isMounted) setData(JSON.parse(raw));
        } else {
          const SQLite = await import("expo-sqlite");
          const api: any = SQLite as any;
          const db = api.openDatabase ? api.openDatabase("app.db") : api.openDatabaseSync("app.db");
          db.readTransaction((tx: any) => {
            tx.executeSql(
              "SELECT data_json FROM questionnaires WHERE user_id = ? LIMIT 1",
              [userId],
              (_tx: any, res: any) => {
                const raw = res?.rows?._array?.[0]?.data_json;
                if (raw && isMounted) setData(JSON.parse(raw));
              }
            );
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, userId]);

  const save = React.useCallback(async () => {
    try {
      setSaving(true);
      if (Platform.OS === "web") {
        const key = `q_${userId ?? "web"}`;
        if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(data));
        Alert.alert("Saved", "Your responses were saved.");
        return;
      }
      const SQLite = await import("expo-sqlite");
      const api: any = SQLite as any;
      const db = api.openDatabase ? api.openDatabase("app.db") : api.openDatabaseSync("app.db");
      db.transaction((tx: any) => {
        tx.executeSql(
          "INSERT INTO questionnaires (user_id, data_json, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at",
          [userId, JSON.stringify(data)],
          () => {
            Alert.alert("Saved", "Your responses were saved.");
          }
        );
      });
    } finally {
      setSaving(false);
    }
  }, [data, userId]);

  const update = (key: keyof QuestionnaireData, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.title}>Questionnaire</Text>
          <Text style={styles.subtitle}>Your answers are saved to your profile.</Text>

          <Field
            label="Family history"
            value={data.familyHistory}
            onChangeText={(t) => update("familyHistory", t)}
            placeholder="e.g., Father with heart disease, maternal grandmother with breast cancer"
          />
          <Field
            label="Exercise routines"
            value={data.exerciseRoutines}
            onChangeText={(t) => update("exerciseRoutines", t)}
            placeholder="e.g., 3x/week jogging, 30 min strength training"
          />
          <Field
            label="Dietary habits"
            value={data.dietaryHabits}
            onChangeText={(t) => update("dietaryHabits", t)}
            placeholder="e.g., balanced meals, low processed foods, 2L water/day"
          />
          <Field
            label="Medications"
            value={data.medications}
            onChangeText={(t) => update("medications", t)}
            placeholder="e.g., Metformin 500mg BID, Lisinopril 10mg daily"
          />

          <Pressable disabled={loading || saving} onPress={save} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; }) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        style={styles.input}
      />
    </View>
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
  scroll: {
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
  },
  fieldContainer: {
    marginTop: 16,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    textAlignVertical: "top",
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});


