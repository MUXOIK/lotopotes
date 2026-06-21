import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'fr.lotopotes.app',
  appName: 'Les Potes Millionnaires',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#111827',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#111827',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
}

export default config
