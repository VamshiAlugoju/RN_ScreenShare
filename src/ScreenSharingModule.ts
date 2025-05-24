import { NativeModules, DeviceEventEmitter, EmitterSubscription } from 'react-native';

interface ScreenSharingModuleInterface {
  requestScreenSharePermission(): Promise<number>;
  startScreenCapture(resultCode: number): Promise<string>;
  stopScreenCapture(): Promise<string>;
  captureScreenshot(): Promise<string>;
  isScreenCaptureActive(): Promise<boolean>;
  startLiveStreaming(): Promise<string>;
  stopLiveStreaming(): Promise<string>;
  isLiveStreamingActive(): Promise<boolean>;
}

const { ScreenSharingModule } = NativeModules;

export interface ScreenSharingEvents {
  ScreenCaptureStarted: () => void;
  ScreenCaptureStopped: () => void;
  ScreenFrameAvailable: () => void;
  LiveStreamingStarted: () => void;
  LiveStreamingStopped: () => void;
  LiveFrameCapture: (data: { frameData: string; timestamp: number }) => void;
}

export class ScreenSharingManager {
  private static instance: ScreenSharingManager;
  private isCapturing = false;
  private isLiveStreaming = false;
  private resultCode: number | null = null;
  private liveFrameListeners: ((frameData: string) => void)[] = [];

  private constructor() {}

  static getInstance(): ScreenSharingManager {
    if (!ScreenSharingManager.instance) {
      ScreenSharingManager.instance = new ScreenSharingManager();
    }
    return ScreenSharingManager.instance;
  }

  async requestPermissionAndStartCapture(): Promise<void> {
    try {
      // Request permission first
      this.resultCode = await ScreenSharingModule.requestScreenSharePermission();
      
      // Start capture with the result code
      await ScreenSharingModule.startScreenCapture(this.resultCode);
      this.isCapturing = true;
    } catch (error) {
      console.error('Failed to start screen capture:', error);
      throw error;
    }
  }

  async startLiveStreaming(): Promise<void> {
    try {
      if (!this.isCapturing) {
        throw new Error('Screen capture must be active before starting live streaming');
      }
      
      await ScreenSharingModule.startLiveStreaming();
      this.isLiveStreaming = true;
    } catch (error) {
      console.error('Failed to start live streaming:', error);
      throw error;
    }
  }

  async stopLiveStreaming(): Promise<void> {
    try {
      await ScreenSharingModule.stopLiveStreaming();
      this.isLiveStreaming = false;
    } catch (error) {
      console.error('Failed to stop live streaming:', error);
      throw error;
    }
  }

  async stopCapture(): Promise<void> {
    try {
      if (this.isLiveStreaming) {
        await this.stopLiveStreaming();
      }
      await ScreenSharingModule.stopScreenCapture();
      this.isCapturing = false;
      this.resultCode = null;
    } catch (error) {
      console.error('Failed to stop screen capture:', error);
      throw error;
    }
  }

  async captureScreenshot(): Promise<string> {
    try {
      return await ScreenSharingModule.captureScreenshot();
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      throw error;
    }
  }

  async isActive(): Promise<boolean> {
    try {
      return await ScreenSharingModule.isScreenCaptureActive();
    } catch (error) {
      console.error('Failed to check capture status:', error);
      return false;
    }
  }

  async isLiveStreamingActive(): Promise<boolean> {
    try {
      return await ScreenSharingModule.isLiveStreamingActive();
    } catch (error) {
      console.error('Failed to check live streaming status:', error);
      return false;
    }
  }

  // Live frame listener management
  addLiveFrameListener(listener: (frameData: string) => void): void {
    this.liveFrameListeners.push(listener);
  }

  removeLiveFrameListener(listener: (frameData: string) => void): void {
    const index = this.liveFrameListeners.indexOf(listener);
    if (index > -1) {
      this.liveFrameListeners.splice(index, 1);
    }
  }

  private notifyLiveFrameListeners(frameData: string): void {
    this.liveFrameListeners.forEach(listener => {
      try {
        listener(frameData);
      } catch (error) {
        console.error('Error in live frame listener:', error);
      }
    });
  }

  // Event listeners
  addListener<K extends keyof ScreenSharingEvents>(
    eventName: K,
    listener: ScreenSharingEvents[K]
  ): EmitterSubscription {
    if (eventName === 'LiveFrameCapture') {
      return DeviceEventEmitter.addListener(eventName, (data: { frameData: string; timestamp: number }) => {
        this.notifyLiveFrameListeners(data.frameData);
        (listener as any)(data);
      });
    }
    return DeviceEventEmitter.addListener(eventName, listener);
  }

  removeAllListeners(eventName?: keyof ScreenSharingEvents): void {
    if (eventName) {
      DeviceEventEmitter.removeAllListeners(eventName);
    } else {
      DeviceEventEmitter.removeAllListeners('ScreenCaptureStarted');
      DeviceEventEmitter.removeAllListeners('ScreenCaptureStopped');
      DeviceEventEmitter.removeAllListeners('ScreenFrameAvailable');
      DeviceEventEmitter.removeAllListeners('LiveStreamingStarted');
      DeviceEventEmitter.removeAllListeners('LiveStreamingStopped');
      DeviceEventEmitter.removeAllListeners('LiveFrameCapture');
    }
    this.liveFrameListeners = [];
  }

  getCaptureStatus(): boolean {
    return this.isCapturing;
  }

  getLiveStreamingStatus(): boolean {
    return this.isLiveStreaming;
  }
}

export default ScreenSharingModule as ScreenSharingModuleInterface; 