import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.anand.lumi',
  appName: 'Lumi',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // Keep Android edge-to-edge and expose one CSS safe-area source to the app.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      // Dark carbon surfaces use light system-bar icons.
      style: 'DARK',
      hidden: false,
    },
  },
}

export default config
