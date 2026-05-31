import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.elk.pixigame',
  appName: 'PixiGame',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    // Respect the safe area (notch / home indicator) so content is not clipped.
    contentInset: 'always',
  },
};

export default config;
