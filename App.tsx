// Read comments

import React, {useEffect, useState, useCallback} from 'react';
import type {PropsWithChildren} from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Platform,
  PermissionsAndroid,
  Touchable,
  TouchableOpacity,
} from 'react-native';

import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {RTCView, mediaDevices, registerGlobals} from 'react-native-webrtc';
import {
  createNotificationChannels,
  showDisplayProjectionNotificaion,
  stopForegroundService,
} from './createNotificationChannel';
registerGlobals();

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [url, setUrl] = useState<null | string>(null);
  const [stream, setStream] = useState<any>(null);

  // Cleanup function for screen sharing
  const cleanupScreenSharing = useCallback(async () => {
    if (stream) {
      console.log('Cleaning up screen sharing...');
      stream.getTracks().forEach((track: any) => track.stop());
      setStream(null);
      setUrl(null);
      await stopForegroundService();
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupScreenSharing();
    };
  }, [cleanupScreenSharing]);

  const requestPermission = async () => {
    await requestCameraPermission();
    await requestMicrophonePermission();
    await requestNotificationPermission();
  };

  const produceScreenMedia = async () => {
    try {
      // Clean up existing stream
      await cleanupScreenSharing();
      
      // First ensure we have notification permission
      await requestNotificationPermission();
      
      // Show the foreground notification
      await showDisplayProjectionNotificaion();

      console.log('Requesting screen share permission...');
      const screenStream = await mediaDevices.getDisplayMedia();
      setStream(screenStream);
      
      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track available');
      }

      console.log('Got video track, state:', videoTrack.readyState);
      videoTrack.enabled = true;

      const streamUrl = screenStream.toURL();
      console.log('Stream URL created:', streamUrl);
      setUrl(streamUrl);

      // Monitor track state
      const checkTrackInterval = setInterval(() => {
        if (!videoTrack || videoTrack.readyState === 'ended') {
          console.log('Track ended, cleaning up...');
          clearInterval(checkTrackInterval);
          cleanupScreenSharing();
        }
      }, 1000);

      return () => {
        clearInterval(checkTrackInterval);
        cleanupScreenSharing();
      };

    } catch (error) {
      console.error('Error in screen sharing:', error);
      await cleanupScreenSharing();
    }
  };

  const showNotificationWithoutScreenShare = async () => {
    try {
      // First ensure we have notification permission
      await requestNotificationPermission();
      await showDisplayProjectionNotificaion();
    } catch (error) {
      console.error('Error showing notification:', error);
      await stopForegroundService();
    }
  };

  useEffect(() => {
    const iffe = async () => {
      await createNotificationChannels();
    };
    iffe();
    return () => {
      stopForegroundService();
    };
  }, []);

  async function resetNotification() {
    await stopForegroundService();
  }

  return (
    <View style={{flex: 1, paddingTop: 50, gap: 20, alignItems: 'center'}}>
      <Text style={{fontSize: 15}}> First grant necessary permissions </Text>
      <TouchableOpacity
        onPress={requestPermission}
        style={{
          backgroundColor: 'blue',
          padding: 10,
          alignItems: 'center',
          width: 200,
          alignSelf: 'center',
        }}>
        <Text style={{color: 'white'}}>request Permissions</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={showNotificationWithoutScreenShare}
        style={{
          backgroundColor: 'blue',
          padding: 10,
          alignItems: 'center',
          width: 200,
          alignSelf: 'center',
        }}>
        <Text style={{color: 'white'}}>
          show foreground notification without ScreenSharing intent
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={produceScreenMedia}
        style={{
          backgroundColor: 'blue',
          padding: 10,
          alignItems: 'center',
          width: 200,
          alignSelf: 'center',
        }}>
        <Text style={{color: 'white'}}>share Screen </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={resetNotification}
        style={{
          backgroundColor: 'blue',
          padding: 10,
          alignItems: 'center',
          width: 200,
          alignSelf: 'center',
        }}>
        <Text style={{color: 'white'}}>reset notification</Text>
      </TouchableOpacity>
      {url && stream && (
        <View style={{
          width: 300,
          height: 300,
          backgroundColor: '#000',
          overflow: 'hidden',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#ccc',
          marginTop: 20,
        }}>
          <RTCView
            streamURL={url}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
            }}
            objectFit="contain"
            zOrder={1}
            mirror={false}
          />
        </View>
      )}
    </View>
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
  try {
    if (Platform.OS === 'android') {
      // Request general notification permission
      const settings = await notifee.requestPermission();
      
      if (settings.authorizationStatus !== 1) {
        throw new Error('Notification permission not granted');
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    throw error;
  }
};
