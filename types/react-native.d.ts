declare module 'react-native' {
  export interface NativeModulesStatic {
    ScreenSharingModule: {
      requestScreenSharePermission(): Promise<number>;
      startScreenCapture(resultCode: number): Promise<string>;
      stopScreenCapture(): Promise<string>;
      captureScreenshot(): Promise<string>;
      isScreenCaptureActive(): Promise<boolean>;
      startLiveStreaming(): Promise<string>;
      stopLiveStreaming(): Promise<string>;
      isLiveStreamingActive(): Promise<boolean>;
    };
  }

  export const NativeModules: NativeModulesStatic;
  export const DeviceEventEmitter: any;
  export type EmitterSubscription = {
    remove(): void;
  };

  // React Native Components and APIs
  export const Text: any;
  export const View: any;
  export const TouchableOpacity: any;
  export const Image: any;
  export const ScrollView: any;
  export const Alert: any;
  export const Platform: any;
  export const PermissionsAndroid: any;
  export const Dimensions: any;
  export function useColorScheme(): 'light' | 'dark' | null | undefined;
} 