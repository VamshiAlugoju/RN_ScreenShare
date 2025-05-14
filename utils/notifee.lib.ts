import notifee, { AndroidCategory, AndroidChannel, AndroidForegroundServiceType, AndroidImportance, AndroidVisibility } from '@notifee/react-native';


const notificationChannels: { [key: string]: AndroidChannel } = {
  calls: {
    id: 'calls',
    name: 'Calls',
    description: 'Incoming call notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  },
  screenCapture: {
    id: 'screen_capture',
    name: 'Screen Capture',
    lights: false,
    vibration: true,
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  }
};

export const createNotificationChannels = async () => {
  try {
    // Create the channel and wait for it to be created
    await notifee.deleteChannel(notificationChannels.screenCapture.id);
    const channelId = await notifee.createChannel(notificationChannels.screenCapture);
    
    // Register foreground service
    notifee.registerForegroundService(() => {
      return new Promise(() => {
        // Keep alive until explicitly stopped
      });
    });
    
    return channelId;
  } catch (error) {
    console.error('Error creating notification channel:', error);
    throw error;
  }
};


export async function showDisplayProjectionNotificaion() {
  try {
    // Ensure channel exists before showing notification
    const channel = await notifee.getChannel(notificationChannels.screenCapture.id);
    if (!channel) {
      await createNotificationChannels();
    }

    // Show the notification with proper foreground service configuration
    await notifee.displayNotification({
      id: 'screen_capture',
      title: 'Screen Capture',
      body: 'Screen sharing is active',
      android: {
        channelId: notificationChannels.screenCapture.id,
        asForegroundService: true,
        ongoing: true,
        smallIcon: 'react_native',
        autoCancel: false,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.SERVICE,
      }
    });
  } catch (err) {
    console.error('Error showing notification:', err);
    throw err;
  }
}



export async function stopForegroundService() {
  try {
    // First cancel the specific notification
    await notifee.cancelNotification('screen_capture');
    // Then stop the foreground service
    await notifee.stopForegroundService();
  } catch (err) {
    console.error('Error stopping foreground service:', err);
    throw err;
  }
}