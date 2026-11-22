/**
 * Config dinâmica sobre o app.json.
 *
 * Google Maps (só necessário em builds de loja/dev build; Expo Go já funciona sem chave):
 *   GOOGLE_MAPS_ANDROID_API_KEY  → restrinja ao package app.fomo.mobile + SHA-1 do certificado
 *   GOOGLE_MAPS_IOS_API_KEY      → opcional (iOS usa Apple Maps por padrão); restrinja ao bundle id
 * Defina como variáveis de ambiente locais ou "EAS Secrets". Nunca commite as chaves.
 *
 * FOMO_PREVIEW=1 → build Web em arquivo único (rotas síncronas) para a prévia em artifact.
 */
module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];

  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  if (androidKey || iosKey) {
    plugins.push([
      'react-native-maps',
      {
        ...(androidKey ? { androidGoogleMapsApiKey: androidKey } : {}),
        ...(iosKey ? { iosGoogleMapsApiKey: iosKey } : {}),
      },
    ]);
  }

  const finalPlugins =
    process.env.FOMO_PREVIEW === '1'
      ? plugins.map((p) => (p === 'expo-router' ? ['expo-router', { asyncRoutes: false }] : p))
      : plugins;

  return { ...config, plugins: finalPlugins };
};
