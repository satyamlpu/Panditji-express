import { useNetInfo } from "@react-native-community/netinfo";

// True unless NetInfo explicitly reports no connection. `null` (not yet known —
// e.g. at startup) is treated as online so there is no flash of "offline".
export function useOnline(): boolean {
  const net = useNetInfo();
  return net.isConnected !== false;
}
