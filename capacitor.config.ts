import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.warungendogyati.kasir',
  appName: 'Warung Endog Yati',
  webDir: 'dist',
  android: {
    backgroundColor: '#FFF8E7',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#F6B800',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
