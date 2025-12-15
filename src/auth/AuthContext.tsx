import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  sessionError: string | null;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  sessionError: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setSessionError(null);

    // ⏱️ Evita “Cargando sesión…” infinito
    const timeout = window.setTimeout(() => {
      setLoading(false);
      setSessionError(
        "La sesión está tardando demasiado. Revisa tu conexión o recarga la página."
      );
    }, 8000);

    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        window.clearTimeout(timeout);
        setUser(u);
        setLoading(false);
        setSessionError(null);
      },
      (err) => {
        window.clearTimeout(timeout);
        setUser(null);
        setLoading(false);
        setSessionError(err?.message ?? "Error obteniendo sesión");
      }
    );

    return () => {
      window.clearTimeout(timeout);
      unsub();
    };
  }, []);

  const value = useMemo(() => ({ user, loading, sessionError }), [user, loading, sessionError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
