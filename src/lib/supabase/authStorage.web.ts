// Web: localStorage do navegador (sem expo-sqlite no bundle Web).
export const authStorage = typeof window !== 'undefined' ? window.localStorage : undefined;
