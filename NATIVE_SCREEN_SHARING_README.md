# Native Android Screen Sharing Module

This React Native app now uses a custom native Android module for screen sharing instead of react-native-webrtc.

## Features

- **Native Android MediaProjection API**: Uses Android's native screen capture capabilities
- **Screenshot Capture**: Ability to capture individual screenshots during screen sharing
- **Foreground Service Integration**: Works with notification service for proper background operation
- **Event System**: Real-time events for screen capture state changes
- **TypeScript Support**: Full TypeScript interface and type safety

## Architecture

### Native Android Components

1. **ScreenSharingModule.kt**: Main native module handling MediaProjection
2. **ScreenSharingPackage.kt**: React Native package registration
3. **MainActivity.kt**: Handles activity results for permissions

### React Native Components

1. **ScreenSharingModule.ts**: TypeScript interface and manager class
2. **App.tsx**: Updated UI using native screen sharing

## API Reference

### ScreenSharingManager Methods

```typescript
// Get singleton instance
const screenSharingManager = ScreenSharingManager.getInstance();

// Request permission and start capture
await screenSharingManager.requestPermissionAndStartCapture();

// Stop screen capture
await screenSharingManager.stopCapture();

// Capture a screenshot (returns base64 string)
const screenshot = await screenSharingManager.captureScreenshot();

// Check if capture is active
const isActive = await screenSharingManager.isActive();
```

### Event Listeners

```typescript
// Listen for screen capture events
const startedListener = screenSharingManager.addListener('ScreenCaptureStarted', () => {
  console.log('Screen capture started');
});

const stoppedListener = screenSharingManager.addListener('ScreenCaptureStopped', () => {
  console.log('Screen capture stopped');
});

const frameListener = screenSharingManager.addListener('ScreenFrameAvailable', () => {
  console.log('New frame available');
});

// Clean up listeners
startedListener.remove();
stoppedListener.remove();
frameListener.remove();
```

## Required Permissions

The following permissions are already configured in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.MANAGE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## Usage Flow

1. **Request Permissions**: User grants camera, microphone, and notification permissions
2. **Start Screen Share**: Request MediaProjection permission and start capture
3. **Capture Screenshots**: Take individual screenshots during active capture
4. **Stop Screen Share**: Stop capture and clean up resources

## Differences from WebRTC Implementation

### Advantages
- **Native Performance**: Direct use of Android MediaProjection API
- **Better Control**: More granular control over capture settings
- **Smaller Bundle**: No need for heavy WebRTC library
- **Custom Features**: Easy to add custom screenshot capture functionality

### Limitations
- **Android Only**: This implementation is specific to Android
- **No Real-time Streaming**: Focused on screenshot capture rather than live streaming
- **Manual Frame Processing**: Requires manual handling of frame processing if needed

## Building and Running

```bash
# Install dependencies (react-native-webrtc has been removed)
npm install

# Run on Android
npx react-native run-android
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Make sure to request permissions before starting screen capture
2. **Activity Not Available**: Ensure the activity is in foreground when requesting permissions
3. **Media Projection Failed**: Check that the user granted screen capture permission

### Debug Information

Check the React Native logs for detailed error messages:

```bash
npx react-native log-android
```

## Future Enhancements

Possible improvements that could be added:

1. **Real-time Frame Processing**: Continuous frame capture and processing
2. **Video Recording**: Save captured frames as video files
3. **Quality Settings**: Configurable capture resolution and quality
4. **Multiple Display Support**: Support for multiple displays
5. **iOS Implementation**: Create equivalent iOS native module 