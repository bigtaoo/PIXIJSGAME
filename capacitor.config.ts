import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gamestao.sumquest',
  appName: 'SumQuest',
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
