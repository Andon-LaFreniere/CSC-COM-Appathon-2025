import React from "react";
import { SafeAreaView, View, Text, StyleSheet, TextInput, Pressable, ScrollView, Platform, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";

const SAMPLE_CSV = `medication,dose,frequency,start_date,end_date,notes
Metformin,500mg,BID,2024-01-01,,After meals
Lisinopril,10mg,QD,2024-02-10,,Blood pressure`;

export default function MedicationLogScreen() {
  const { userId } = useAuth();
  const [csv, setCsv] = React.useState<string>(SAMPLE_CSV);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState<boolean>(false);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (Platform.OS === "web") {
          const key = `medlog_${userId ?? "web"}`;
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
          if (raw && isMounted) setCsv(raw);
        } else {
          const SQLite = await import("expo-sqlite");
          const api: any = SQLite as any;
          const db = api.openDatabase ? api.openDatabase("app.db") : api.openDatabaseSync("app.db");
          db.readTransaction((tx: any) => {
            tx.executeSql(
              "SELECT medication, dose, frequency, start_date, end_date, notes FROM medications_log WHERE user_id = ? ORDER BY id ASC",
              [userId],
              (_tx: any, res: any) => {
                const rows = res?.rows?._array ?? [];
                if (rows.length > 0) {
                  const header = "medication,dose,frequency,start_date,end_date,notes";
                  const lines = rows.map((r: any) =>
                    [r.medication, r.dose ?? "", r.frequency ?? "", r.start_date ?? "", r.end_date ?? "", r.notes ?? ""].map(escapeCsv).join(",")
                  );
                  const text = [header, ...lines].join("\n");
                  if (isMounted) setCsv(text);
                }
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
  }, [userId]);

  const onSave = React.useCallback(async () => {
    try {
      setSaving(true);
      const { headerOk, records, error } = parseCsv(csv);
      if (!headerOk) {
        Alert.alert("Invalid CSV", error ?? "Missing or incorrect header row");
        return;
      }
      if (Platform.OS === "web") {
        const key = `medlog_${userId ?? "web"}`;
        if (typeof window !== "undefined") window.localStorage.setItem(key, csv);
        Alert.alert("Saved", "Medications saved.");
        return;
      }
      const SQLite = await import("expo-sqlite");
      const api: any = SQLite as any;
      const db = api.openDatabase ? api.openDatabase("app.db") : api.openDatabaseSync("app.db");
      db.transaction((tx: any) => {
        tx.executeSql("DELETE FROM medications_log WHERE user_id = ?", [userId]);
        for (const r of records) {
          tx.executeSql(
            "INSERT INTO medications_log (user_id, medication, dose, frequency, start_date, end_date, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            [userId, r.medication, r.dose, r.frequency, r.start_date, r.end_date, r.notes]
          );
        }
      },
      () => Alert.alert("Error", "Failed saving medications"),
      () => Alert.alert("Saved", "Medications saved."));
    } finally {
      setSaving(false);
    }
  }, [csv, userId]);

  const { records: preview } = parseCsv(csv);

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.title}>Medication Log</Text>
          <Text style={styles.subtitle}>Paste CSV data and save to your profile.</Text>

          <Text style={styles.label}>CSV (headers required):</Text>
          <Text style={styles.headerHelp}>medication,dose,frequency,start_date,end_date,notes</Text>
          <TextInput
            value={csv}
            onChangeText={setCsv}
            multiline
            style={styles.csvInput}
          />

          <Pressable disabled={loading || saving} onPress={onSave} style={styles.button}>
            <Text style={styles.buttonText}>{saving ? "Saving..." : "Save"}</Text>
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview</Text>
            {preview.length === 0 ? (
              <Text style={styles.helper}>No valid rows found.</Text>
            ) : (
              preview.map((r, idx) => (
                <Text key={idx} style={styles.itemText}>
                  • {r.medication} {r.dose ? `(${r.dose})` : ""} {r.frequency ? `- ${r.frequency}` : ""}
                </Text>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function parseCsv(text: string): { headerOk: boolean; records: Array<RecordRow>; error?: string } {
  const lines = (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headerOk: false, records: [], error: "CSV is empty" };
  const header = lines[0].toLowerCase();
  const expected = "medication,dose,frequency,start_date,end_date,notes";
  if (header !== expected) return { headerOk: false, records: [], error: `Header must be: ${expected}` };
  const records: Array<RecordRow> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 6) continue;
    records.push({
      medication: cols[0] || "",
      dose: cols[1] || "",
      frequency: cols[2] || "",
      start_date: cols[3] || "",
      end_date: cols[4] || "",
      notes: cols[5] || "",
    });
  }
  return { headerOk: true, records };
}

type RecordRow = {
  medication: string;
  dose: string;
  frequency: string;
  start_date: string;
  end_date: string;
  notes: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function escapeCsv(s: string): string {
  if (s == null) return "";
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
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
  label: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  headerHelp: {
    color: "#666",
    fontSize: 12,
    marginBottom: 6,
  },
  csvInput: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as any,
  },
  button: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  section: {
    marginTop: 16,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  itemText: {
    fontSize: 16,
  },
  helper: {
    color: "#666",
  },
});
