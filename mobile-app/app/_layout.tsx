import { Stack, useRouter, useSegments } from "expo-router";
import React from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    const inLoginRoute = segments[0] === "login";
    if (!isAuthenticated && !inLoginRoute) {
      router.replace("/login");
    }
    if (isAuthenticated && inLoginRoute) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: "Login" }} />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}
