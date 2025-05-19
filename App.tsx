import React, {useEffect, useState} from 'react';
import {
  Text,
  useColorScheme,
  View,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
} from 'react-native';

import notifee from '@notifee/react-native';
[];
import {
  MediaStream,
  RTCView,
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
    try {
      const screenStream = await mediaDevices.getDisplayMedia();

      const videoTrack = screenStream.getVideoTracks()[0];

      if (videoTrack) {
        const newStream = new MediaStream([videoTrack]);

        // Wait briefly before starting foreground notification
        await new Promise(resolve => setTimeout(resolve, 500));
        await showDisplayProjectionNotificaion();

        const url = newStream.toURL();
        setUrl(url);

        console.log('Screen sharing started', url);
      } else {
        console.warn('No video track found');
      }
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
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
            backgroundColor: 'black',
          }}
          mirror={false}
          objectFit="contain"
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
