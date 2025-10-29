import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = React.useState("John Smith");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = React.useCallback(async () => {
    setError(null);
    const ok = await login(username.trim(), password);
    if (!ok) {
      setError("Invalid credentials");
      return;
    }
    router.replace("/");
  }, [login, password, router, username]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <TextInput
        placeholder="Name"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={onSubmit} disabled={isLoading} style={styles.button}>
        <Text style={styles.buttonText}>{isLoading ? "Loading..." : "Login"}</Text>
      </Pressable>
      <Text style={styles.helper}>Try: John Smith / john (or demo / demo)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#b91c1c",
  },
  helper: {
    marginTop: 8,
    color: "#666",
  },
});


