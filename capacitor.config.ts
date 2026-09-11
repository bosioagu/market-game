/**
 * Empaquetado como app nativa (Android / iOS) con Capacitor.
 * El juego en sí es el mismo build web de `dist/`.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ar.com.miakiki.market',
  appName: 'Mía & Kiki Market',
  webDir: 'dist',
  // El juego se dibuja de borde a borde y maneja su propio fondo.
  backgroundColor: '#15111f',
  android: {
    backgroundColor: '#15111f',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#15111f',
  },
};

export default config;
