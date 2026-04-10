import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kamaclock.controller',
  appName: 'Kama Clock Controller',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
