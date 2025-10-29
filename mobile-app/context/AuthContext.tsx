import React from "react";
import { Platform } from "react-native";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: number | null;
  currentPatientName: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

// Lazy-load SQLite only on native to avoid web/SSR crashes
let nativeDb: any | null = null;
async function getNativeDb() {
  if (Platform.OS === "web") return null;
  if (!nativeDb) {
    const SQLite = await import("expo-sqlite");
    const api: any = SQLite as any;
    nativeDb = api.openDatabase ? api.openDatabase("app.db") : api.openDatabaseSync("app.db");
  }
  return nativeDb;
}

async function run(sql: string, params: Array<string | number | null> = []) {
  const db = await getNativeDb();
  if (!db) return; // no-op on web
  await new Promise<void>((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(sql, params, () => resolve());
      },
      (err: any) => reject(err)
    );
  });
}

async function getFirst<T = any>(
  sql: string,
  params: Array<string | number | null> = []
): Promise<T | undefined> {
  const db = await getNativeDb();
  if (!db) return undefined;
  return await new Promise<T | undefined>((resolve, reject) => {
    db.readTransaction(
      (tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_tx: any, result: any) => {
            const row = result?.rows?._array?.[0];
            resolve(row as T | undefined);
          },
          (_tx: any, error: any) => {
            reject(error);
            return true;
          }
        );
      },
      (err: any) => reject(err)
    );
  });
}

async function initDb() {
  if (Platform.OS === "web") return; // skip DB on web
  await run(`PRAGMA foreign_keys = ON;`);
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);

  await run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    mrn TEXT,
    name TEXT,
    gender TEXT,
    age INTEGER,
    profile_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );`);

  await run(`CREATE TABLE IF NOT EXISTS questionnaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
  );`);

  await run(`CREATE TABLE IF NOT EXISTS medications_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    medication TEXT NOT NULL,
    dose TEXT,
    frequency TEXT,
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);

  const row = await getFirst<{ count: number }>(
    "SELECT COUNT(1) as count FROM users;"
  );
  const count = row ? (row as any).count : 0;
  if (!count) {
    await run("INSERT INTO users (username, password) VALUES (?, ?)", [
      "demo",
      "demo",
    ]);
  }

  // Ensure a user for the seeded patient name exists, and link the patient
  const jsUser = await getFirst<{ id: number }>(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    ["John Smith"]
  );
  let jsUserId = jsUser?.id;
  if (!jsUserId) {
    await run("INSERT INTO users (username, password) VALUES (?, ?)", [
      "John Smith",
      "john",
    ]);
    const newUser = await getFirst<{ id: number }>(
      "SELECT id FROM users WHERE username = ? ORDER BY id DESC LIMIT 1",
      ["John Smith"]
    );
    jsUserId = newUser?.id ?? undefined as unknown as number | undefined;
  }

  // Seed one sample patient if none exist
  const pCountRow = await getFirst<{ count: number }>(
    "SELECT COUNT(1) as count FROM patients;"
  );
  const pCount = pCountRow ? (pCountRow as any).count : 0;
  if (!pCount) {
    const sample = {
      MRN: "P001",
      name: "John Smith",
      age: 35,
      gender: "male",
    } as const;
    const profile = {
      MRN: sample.MRN,
      name: sample.name,
      age: sample.age,
      gender: sample.gender,
      source: "seed",
    };
    await run(
      "INSERT INTO patients (user_id, mrn, name, gender, age, profile_json) VALUES (?, ?, ?, ?, ?, ?)",
      [jsUserId ?? 1, sample.MRN, sample.name, sample.gender, sample.age, JSON.stringify(profile)]
    );
  } else if (jsUserId) {
    // Link existing patient to John Smith user if not already linked
    await run(
      "UPDATE patients SET user_id = ? WHERE name = ? AND (user_id IS NULL OR user_id <> ?)",
      [jsUserId, "John Smith", jsUserId]
    );
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [userId, setUserId] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentPatientName, setCurrentPatientName] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        await initDb();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = React.useCallback(async (username: string, password: string) => {
    if (Platform.OS === "web") {
      // Web fallback: allow demo/demo and John Smith/john
      const isDemo = username === "demo" && password === "demo";
      const isJohn = username === "John Smith" && password === "john";
      if (isDemo || isJohn) {
        setIsAuthenticated(true);
        setUserId(isJohn ? 1 : 1);
        setCurrentPatientName(isJohn ? "John Smith" : "demo");
        return true;
      }
      return false;
    }
    const user = await getFirst<{
      id: number;
      username: string;
      password: string;
    }>("SELECT id, username, password FROM users WHERE username = ? LIMIT 1", [
      username,
    ]);
    if (user && user.password === password) {
      setIsAuthenticated(true);
      setUserId(user.id);
      // Fetch associated patient name, if any
      const p = await getFirst<{ name: string }>(
        "SELECT name FROM patients WHERE user_id = ? LIMIT 1",
        [user.id]
      );
      setCurrentPatientName(p?.name ?? user.username);
      return true;
    }
    return false;
  }, []);

  const logout = React.useCallback(async () => {
    setIsAuthenticated(false);
    setUserId(null);
  }, []);

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    userId,
    currentPatientName,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


