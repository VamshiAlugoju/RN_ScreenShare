import notifee, {
  AndroidCategory,
  AndroidChannel,
  AndroidForegroundServiceType,
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';

const notificationChannels: {[key: string]: AndroidChannel} = {
  screenCapture: {
    id: 'screen_capture',
    name: 'Screen Capture',
    lights: false,
    vibration: true,
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  },
};

export const createNotificationChannels = async () => {
  const channelId = await notifee.createChannel(
    notificationChannels.screenCapture,
  );
};

export async function showDisplayProjectionNotificaion() {
  try {
    await notifee.displayNotification({
      title: 'Screen Capture',
      body: 'This notification will be here until you stop capturing.',
      android: {
        channelId: 'screen_capture',

        asForegroundService: true,
        ongoing: true,
        smallIcon: 'react_native',
        autoCancel: false,
      },
    });
  } catch (err) {
    console.log(err);
  }
}

export async function stopForegroundService() {
  try {
    await notifee.stopForegroundService();
  } catch (err) {
    // Handle Error
  }
}
