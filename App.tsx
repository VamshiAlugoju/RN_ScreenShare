import React, {useEffect, useState, useCallback} from 'react';
import {
  Text,
  useColorScheme,
  View,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';

import notifee from '@notifee/react-native';
import { ScreenSharingManager } from './src/ScreenSharingModule';
import {
  createNotificationChannels,
  showDisplayProjectionNotificaion,
  stopForegroundService,
} from './createNotificationChannel';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [liveFrameBase64, setLiveFrameBase64] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState<number>(0);
  
  const screenSharingManager = ScreenSharingManager.getInstance();
  const { width: screenWidth } = Dimensions.get('window');
  const liveViewWidth = screenWidth - 40;
  const liveViewHeight = (liveViewWidth * 16) / 9; // 16:9 aspect ratio

  const requestPermission = async () => {
    await requestCameraPermission();
    await requestMicrophonePermission();
    await requestNotificationPermission();
  };

  const startNativeScreenShare = async () => {
    try {
      // Start foreground notification first
      await showDisplayProjectionNotificaion();
      
      // Request permission and start capture
      await screenSharingManager.requestPermissionAndStartCapture();
      setIsCapturing(true);

      await screenSharingManager.startLiveStreaming();
      setIsLiveStreaming(true);
      setFrameCount(0);
      
      console.log('Native screen sharing started successfully');
      Alert.alert('Success', 'Screen sharing started successfully');
    } catch (error) {
      console.error('Failed to start native screen sharing:', error);
      Alert.alert('Error', `Failed to start screen sharing: ${error}`);
      // Stop notification if screen sharing failed
      await stopForegroundService();
    }
  };

  const startLiveStreaming = async () => {
    try {
      if (!isCapturing) {
        Alert.alert('Error', 'Please start screen capture first');
        return;
      }
      
      await screenSharingManager.startLiveStreaming();
      setIsLiveStreaming(true);
      setFrameCount(0);
      
      console.log('Live streaming started successfully');
      Alert.alert('Success', 'Live streaming started!');
    } catch (error) {
      console.error('Failed to start live streaming:', error);
      Alert.alert('Error', `Failed to start live streaming: ${error}`);
    }
  };

  const stopLiveStreaming = async () => {
    try {
      await screenSharingManager.stopLiveStreaming();
      setIsLiveStreaming(false);
      setLiveFrameBase64(null);
      
      console.log('Live streaming stopped');
      Alert.alert('Success', 'Live streaming stopped');
    } catch (error) {
      console.error('Failed to stop live streaming:', error);
      Alert.alert('Error', `Failed to stop live streaming: ${error}`);
    }
  };

  const stopNativeScreenShare = async () => {
    try {
      await screenSharingManager.stopCapture();
      await stopForegroundService();
      setIsCapturing(false);
      setIsLiveStreaming(false);
      setScreenshotBase64(null);
      setLiveFrameBase64(null);
      
      console.log('Native screen sharing stopped');
      Alert.alert('Success', 'Screen sharing stopped');
    } catch (error) {
      console.error('Failed to stop native screen sharing:', error);
      Alert.alert('Error', `Failed to stop screen sharing: ${error}`);
    }
  };

  const captureScreenshot = async () => {
    try {
      if (!isCapturing) {
        Alert.alert('Error', 'Screen capture is not active');
        return;
      }
      
      const base64Image = await screenSharingManager.captureScreenshot();
      setScreenshotBase64(base64Image);
      
      console.log('Screenshot captured successfully');
      Alert.alert('Success', 'Screenshot captured!');
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      Alert.alert('Error', `Failed to capture screenshot: ${error}`);
    }
  };

  // Live frame handler
  const handleLiveFrame = useCallback((frameData: string) => {
    setLiveFrameBase64(frameData);
    setFrameCount(prev => prev + 1);
    setLastFrameTime(Date.now());
  }, []);

  useEffect(() => {
    const iffe = async () => {
      await createNotificationChannels();
    };
    iffe();

    // Add event listeners
    const startedListener = screenSharingManager.addListener('ScreenCaptureStarted', () => {
      console.log('Screen capture started event received');
    });

    const stoppedListener = screenSharingManager.addListener('ScreenCaptureStopped', () => {
      console.log('Screen capture stopped event received');
      setIsCapturing(false);
      setIsLiveStreaming(false);
    });

    const frameListener = screenSharingManager.addListener('ScreenFrameAvailable', () => {
      console.log('New frame available');
    });

    const liveStartedListener = screenSharingManager.addListener('LiveStreamingStarted', () => {
      console.log('Live streaming started event received');
      setIsLiveStreaming(true);
    });

    const liveStoppedListener = screenSharingManager.addListener('LiveStreamingStopped', () => {
      console.log('Live streaming stopped event received');
      setIsLiveStreaming(false);
    });

    const liveFrameListener = screenSharingManager.addListener('LiveFrameCapture', (data) => {
      console.log('Live frame received, timestamp:', data.timestamp);
      handleLiveFrame(data.frameData);
    });

    // Add live frame listener using the manager's method
    screenSharingManager.addLiveFrameListener(handleLiveFrame);

    return () => {
      stopForegroundService();
      startedListener.remove();
      stoppedListener.remove();
      frameListener.remove();
      liveStartedListener.remove();
      liveStoppedListener.remove();
      liveFrameListener.remove();
      screenSharingManager.removeLiveFrameListener(handleLiveFrame);
    };
  }, [handleLiveFrame]);

  async function resetNotification() {
    await stopForegroundService();
  }

  return (
    <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 50}}>
      <View style={{flex: 1, paddingTop: 50, gap: 15, alignItems: 'center'}}>
        <Text style={{fontSize: 18, fontWeight: 'bold', textAlign: 'center'}}> 
         Request Permissions and Start Screen Share
        </Text>
        
        <TouchableOpacity
          onPress={requestPermission}
          style={{
            backgroundColor: 'blue',
            padding: 10,
            alignItems: 'center',
            width: 200,
            alignSelf: 'center',
            borderRadius: 5,
          }}>
          <Text style={{color: 'white'}}>Request Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={startNativeScreenShare}
          disabled={isCapturing}
          style={{
            backgroundColor: isCapturing ? 'gray' : 'green',
            padding: 10,
            alignItems: 'center',
            width: 200,
            alignSelf: 'center',
            borderRadius: 5,
          }}>
          <Text style={{color: 'white'}}>
            {isCapturing ? 'Screen Sharing Active' : 'Start Screen Share'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={startLiveStreaming}
          disabled={!isCapturing || isLiveStreaming}
          style={{
            backgroundColor: (!isCapturing || isLiveStreaming) ? 'gray' : 'purple',
            padding: 10,
            alignItems: 'center',
            width: 200,
            alignSelf: 'center',
            borderRadius: 5,
          }}>
          <Text style={{color: 'white'}}>
            {isLiveStreaming ? 'Live Streaming Active' : 'Start Live Stream'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={stopLiveStreaming}
          disabled={!isLiveStreaming}
          style={{
            backgroundColor: !isLiveStreaming ? 'gray' : 'orange',
            padding: 10,
            alignItems: 'center',
            width: 200,
            alignSelf: 'center',
            borderRadius: 5,
          }}>
          <Text style={{color: 'white'}}>Stop Live Stream</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={stopNativeScreenShare}
          disabled={!isCapturing}
          style={{
            backgroundColor: !isCapturing ? 'gray' : 'red',
            padding: 10,
            alignItems: 'center',
            width: 200,
            alignSelf: 'center',
            borderRadius: 5,
          }}>
          <Text style={{color: 'white'}}>Stop Screen Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={captureScreenshot}
          disabled={!isCapturing}
          style={{
            backgroundColor: !isCapturing ? 'gray' : 'orange',
            padding: 10,
            alignItems: 'center',
            width: 200,
            alignSelf: 'center',
            borderRadius: 5,
          }}>
          <Text style={{color: 'white'}}>Capture Screenshot</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={resetNotification}
          style={{
            backgroundColor: 'blue',
            padding: 10,
            alignItems: 'center',
            width: 200,
            alignSelf: 'center',
            borderRadius: 5,
          }}>
          <Text style={{color: 'white'}}>Reset Notification</Text>
        </TouchableOpacity>

        {/* Status Display */}
        <View style={{ alignItems: 'center', gap: 5 }}>
          <Text style={{ 
            color: isCapturing ? 'green' : 'red', 
            fontWeight: 'bold',
            fontSize: 16 
          }}>
            Capture: {isCapturing ? 'ACTIVE' : 'STOPPED'}
          </Text>
          <Text style={{ 
            color: isLiveStreaming ? 'purple' : 'gray', 
            fontWeight: 'bold',
            fontSize: 16 
          }}>
            Live Stream: {isLiveStreaming ? 'ACTIVE' : 'STOPPED'}
          </Text>
          {isLiveStreaming && (
            <Text style={{ color: 'blue', fontSize: 14 }}>
              Frames: {frameCount} | Last: {new Date(lastFrameTime).toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Live Screen Stream Display */}
        {isLiveStreaming && liveFrameBase64 && (
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: 'bold', 
              marginBottom: 10,
              color: 'purple'
            }}>
              🔴 LIVE SCREEN SHARING
            </Text>
            <View style={{
              borderWidth: 3,
              borderColor: 'purple',
              borderRadius: 10,
              padding: 5,
            }}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${liveFrameBase64}` }}
                style={{
                  width: liveViewWidth,
                  height: liveViewHeight,
                  backgroundColor: 'black',
                  resizeMode: 'contain',
                  borderRadius: 5,
                }}
              />
            </View>
            <Text style={{ 
              marginTop: 5, 
              fontSize: 12, 
              color: 'gray',
              textAlign: 'center'
            }}>
              Real-time screen content • {Math.round(liveViewWidth)}x{Math.round(liveViewHeight)}
            </Text>
          </View>
        )}

        {/* Screenshot Display */}
        {screenshotBase64 && (
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ 
              fontSize: 16, 
              fontWeight: 'bold', 
              marginBottom: 10 
            }}>
              Latest Screenshot:
            </Text>
            <Image
              source={{ uri: `data:image/png;base64,${screenshotBase64}` }}
              style={{
                width: 200,
                height: 200,
                backgroundColor: 'black',
                resizeMode: 'contain',
                borderWidth: 1,
                borderColor: 'gray',
                borderRadius: 5,
              }}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

export default App;

const requestCameraPermission = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'We need access to your camera to take photos and videos',
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      },
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    } else {
      console.log('Camera permission denied');
    }
    return granted;
  }

  // For iOS (using react-native-permissions)
  if (Platform.OS === 'ios') {
    // const permission = await request(PERMISSIONS.IOS.CAMERA);
    // if (permission === RESULTS.GRANTED) {
    //   console.log('Camera permission granted');
    // } else {
    //   consoe.log('Camera permission denied');
    // }
  }
};

const requestMicrophonePermission = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'We need access to your microphone to make calls',
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      },
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    } else {
      console.log('Microphone permission denied');
    }
    return granted;
  }
};

const requestNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const settings = await notifee.getNotificationSettings();

    if (settings.authorizationStatus === 0) {
      const status = await notifee.requestPermission();
      if (status.authorizationStatus !== 1) {
        console.warn('Notification permission not granted');
      }
    }
  }
};
