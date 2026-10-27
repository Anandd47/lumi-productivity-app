export const ANDROID_AUTH_CALLBACK_URL = 'com.anand.lumi://auth/callback'

export function authRedirectUrl(platform: string, webOrigin: string): string {
  return platform === 'android' ? ANDROID_AUTH_CALLBACK_URL : webOrigin
}
