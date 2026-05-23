import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "burqan_rep_token";

export async function loadStoredRepToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveRepToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearRepToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
