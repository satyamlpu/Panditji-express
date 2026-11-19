import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Token storage abstraction.
//
// SecureStore keeps the value in the iOS Keychain / Android Keystore — the right
// place for an auth token. It is native-only (no web support per the SDK docs),
// so on web (dev only) we fall back to AsyncStorage. Every call is wrapped so a
// storage failure degrades to "signed out" rather than crashing.
const useSecure = Platform.OS !== "web";

export async function storageGet(key: string): Promise<string | null> {
  try {
    return useSecure ? await SecureStore.getItemAsync(key) : await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (useSecure) await SecureStore.setItemAsync(key, value);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // best effort — a failed write simply means re-auth next launch
  }
}

export async function storageDelete(key: string): Promise<void> {
  try {
    if (useSecure) await SecureStore.deleteItemAsync(key);
    else await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// One-time migration: older builds stored the token in AsyncStorage. On first run
// after the upgrade, move it into SecureStore so existing sessions survive.
export async function storageMigrate(key: string): Promise<string | null> {
  if (!useSecure) return storageGet(key);
  try {
    const current = await SecureStore.getItemAsync(key);
    if (current) return current;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      await SecureStore.setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key);
      return legacy;
    }
  } catch {
    // ignore — treat as no stored token
  }
  return null;
}
