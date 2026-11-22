// iOS/Android: localStorage persistido em SQLite (recomendação atual do guia Expo + Supabase).
import 'expo-sqlite/localStorage/install';

export const authStorage = globalThis.localStorage;
