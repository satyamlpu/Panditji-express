import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setToken, setUnauthorizedHandler } from "./api";

const KEY = "pje_customer_token";

interface AuthState {
  token: string | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  token: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem(KEY);
        if (t) {
          setTok(t);
          setToken(t);
        }
      } catch {
        // storage unavailable — stay signed out
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Drop the session and return to login when the API reports the token is dead.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTok(null);
      setToken(null);
      AsyncStorage.removeItem(KEY).catch(() => {});
      router.replace("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = async (t: string) => {
    setTok(t);
    setToken(t);
    try {
      await AsyncStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  };

  const signOut = async () => {
    setTok(null);
    setToken(null);
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  };

  return <Ctx.Provider value={{ token, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
