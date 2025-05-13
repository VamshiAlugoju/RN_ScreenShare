/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect, useState} from 'react';
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

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ScreenCapturePickerView,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
} from 'react-native-webrtc';
import {
  createNotificationChannels,
  showDisplayProjectionNotificaion,
  stopForegroundService,
} from './createNotificationChannel';
registerGlobals();

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const requestPermission = async () => {
    await requestCameraPermission();
    await requestMicrophonePermission();
    await requestNotificationPermission();
  };

  const [url, setUrl] = useState<null | string>(null);

  const produceScreenMedia = async () => {
    const projection_perm = await AsyncStorage.getItem('display_media_perm');
    if (!projection_perm) {
      const tempStream = await mediaDevices.getDisplayMedia();
      tempStream.release();
      await AsyncStorage.setItem('display_media_perm', JSON.stringify(true));
    }

    await showDisplayProjectionNotificaion();

    const screenStream = await mediaDevices.getDisplayMedia();
    const videoTrack = screenStream.getVideoTracks()[0];
    const url = screenStream.toURL();
    setUrl(url);
    console.log('screen shareing started======>>>>>>');
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
        onPress={async () => {
          await showDisplayProjectionNotificaion();
        }}
        style={{
          backgroundColor: 'blue',
          padding: 10,
          alignItems: 'center',
          width: 200,
          alignSelf: 'center',
        }}>
        <Text style={{color: 'white'}}>
          show foreground notification without ScreenSharing intent (App may
          crash){' '}
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
      {url && (
        <RTCView
          streamURL={url}
          style={{
            width: 200,
            height: 200,
          }}
          objectFit="cover"
          zOrder={1}
        />
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
