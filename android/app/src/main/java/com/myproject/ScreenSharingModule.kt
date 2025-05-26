package com.myproject

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import android.view.Display
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream
import android.util.Base64
import java.util.concurrent.atomic.AtomicBoolean

class ScreenSharingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var mediaProjection: MediaProjection? = null
    private var mediaProjectionManager: MediaProjectionManager? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var isCapturing = false
    private var mediaProjectionCallback: MediaProjection.Callback? = null
    private var isStreamingLive = false
    private var streamingHandler: Handler? = null
    private var streamingRunnable: Runnable? = null
    private val isProcessingFrame = AtomicBoolean(false)
    
    private val SCREEN_CAPTURE_REQUEST_CODE = 1000
    private val TAG = "ScreenSharingModule"
    private val FRAME_RATE_MS = 333L // Capture frame every 333ms (3 FPS) for fast but smooth display
    
    override fun getName(): String {
        return "ScreenSharingModule"
    }

    init {
        try {
            mediaProjectionManager = reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
            streamingHandler = Handler(Looper.getMainLooper())
            Log.d(TAG, "ScreenSharingModule initialized")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize ScreenSharingModule", e)
        }
    }

    @ReactMethod
    fun requestScreenSharePermission(promise: Promise) {
        try {
            Log.d(TAG, "Requesting screen share permission")
            
            val currentActivity = currentActivity
            if (currentActivity == null) {
                Log.e(TAG, "Activity not available")
                promise.reject("ACTIVITY_NOT_AVAILABLE", "Activity not available")
                return
            }

            if (mediaProjectionManager == null) {
                Log.e(TAG, "MediaProjectionManager is null")
                promise.reject("MEDIA_PROJECTION_MANAGER_NULL", "MediaProjectionManager is null")
                return
            }

            val captureIntent = mediaProjectionManager!!.createScreenCaptureIntent()
            if (captureIntent != null) {
                Log.d(TAG, "Starting activity for result")
                currentActivity.startActivityForResult(captureIntent, SCREEN_CAPTURE_REQUEST_CODE)
                
                // Store promise for later resolution
                screenSharePromise = promise
            } else {
                Log.e(TAG, "Failed to create screen capture intent")
                promise.reject("INTENT_CREATION_FAILED", "Failed to create screen capture intent")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting screen share permission", e)
            promise.reject("REQUEST_PERMISSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startScreenCapture(resultCode: Int, promise: Promise) {
        try {
            Log.d(TAG, "Starting screen capture with result code: $resultCode")
            
            if (mediaProjectionManager == null) {
                Log.e(TAG, "MediaProjectionManager is null")
                promise.reject("MEDIA_PROJECTION_MANAGER_NULL", "MediaProjectionManager is null")
                return
            }

            if (screenCaptureData == null) {
                Log.e(TAG, "Screen capture data is null")
                promise.reject("SCREEN_CAPTURE_DATA_NULL", "Screen capture data is null")
                return
            }

            // Start foreground service BEFORE creating MediaProjection
            try {
                startForegroundService()
                Log.d(TAG, "Foreground service started")
                
                // Give the system a moment to register the foreground service
                // This is crucial for MediaProjection to recognize the service
                Thread.sleep(500) // 500ms delay
                Log.d(TAG, "Waited for foreground service registration")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start foreground service", e)
                promise.reject("FOREGROUND_SERVICE_FAILED", "Failed to start foreground service: ${e.message}")
                return
            }

            // Create MediaProjection callback
            mediaProjectionCallback = object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.d(TAG, "MediaProjection stopped by callback")
                    cleanupResources()
                    sendEvent("ScreenCaptureStopped", null)
                }
                
                override fun onCapturedContentResize(width: Int, height: Int) {
                    Log.d(TAG, "MediaProjection content resized: ${width}x${height}")
                }
                
                override fun onCapturedContentVisibilityChanged(isVisible: Boolean) {
                    Log.d(TAG, "MediaProjection content visibility changed: $isVisible")
                }
            }

            // Create media projection from the permission result
            try {
                mediaProjection = mediaProjectionManager!!.getMediaProjection(resultCode, screenCaptureData!!)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to create MediaProjection", e)
                promise.reject("MEDIA_PROJECTION_CREATION_FAILED", "Failed to create MediaProjection: ${e.message}")
                return
            }
            
            if (mediaProjection == null) {
                Log.e(TAG, "MediaProjection is null after creation")
                promise.reject("MEDIA_PROJECTION_NULL", "Failed to create MediaProjection")
                return
            }

            // Register the callback BEFORE starting capture (required for API 34+)
            try {
                mediaProjection!!.registerCallback(mediaProjectionCallback!!, Handler(Looper.getMainLooper()))
                Log.d(TAG, "MediaProjection callback registered")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register MediaProjection callback", e)
                promise.reject("CALLBACK_REGISTRATION_FAILED", "Failed to register callback: ${e.message}")
                return
            }

            // Setup virtual display with error handling
            try {
                setupVirtualDisplay()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to setup virtual display", e)
                cleanupResources()
                promise.reject("VIRTUAL_DISPLAY_SETUP_FAILED", "Failed to setup virtual display: ${e.message}")
                return
            }

            isCapturing = true
            
            Log.d(TAG, "Screen capture started successfully")
            promise.resolve("Screen capture started successfully")
            
            // Send event to React Native
            sendEvent("ScreenCaptureStarted", null)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting screen capture", e)
            cleanupResources()
            promise.reject("START_CAPTURE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startLiveStreaming(promise: Promise) {
        try {
            Log.d(TAG, "Starting live streaming")
            
            if (!isCapturing || imageReader == null) {
                promise.reject("NOT_CAPTURING", "Screen capture is not active")
                return
            }

            if (isStreamingLive) {
                promise.reject("ALREADY_STREAMING", "Live streaming is already active")
                return
            }

            isStreamingLive = true
            startContinuousCapture()
            
            promise.resolve("Live streaming started")
            sendEvent("LiveStreamingStarted", null)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting live streaming", e)
            promise.reject("START_LIVE_STREAMING_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopLiveStreaming(promise: Promise) {
        try {
            Log.d(TAG, "Stopping live streaming")
            
            isStreamingLive = false
            stopContinuousCapture()
            
            promise.resolve("Live streaming stopped")
            sendEvent("LiveStreamingStopped", null)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping live streaming", e)
            promise.reject("STOP_LIVE_STREAMING_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopScreenCapture(promise: Promise) {
        try {
            Log.d(TAG, "Stopping screen capture")
            cleanupResources()
            
            Log.d(TAG, "Screen capture stopped successfully")
            promise.resolve("Screen capture stopped successfully")
            
            // Send event to React Native
            sendEvent("ScreenCaptureStopped", null)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping screen capture", e)
            promise.reject("STOP_CAPTURE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun captureScreenshot(promise: Promise) {
        try {
            Log.d(TAG, "Capturing screenshot")
            
            if (!isCapturing || imageReader == null) {
                Log.w(TAG, "Screen capture is not active")
                promise.reject("NOT_CAPTURING", "Screen capture is not active")
                return
            }

            captureFrame { base64String ->
                if (base64String != null) {
                    promise.resolve(base64String)
                } else {
                    promise.reject("CAPTURE_FAILED", "Failed to capture frame")
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error capturing screenshot", e)
            promise.reject("CAPTURE_SCREENSHOT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isScreenCaptureActive(promise: Promise) {
        promise.resolve(isCapturing)
    }

    @ReactMethod
    fun isLiveStreamingActive(promise: Promise) {
        promise.resolve(isStreamingLive)
    }

    private fun setupVirtualDisplay() {
        try {
            Log.d(TAG, "Setting up virtual display")
            
            val displayManager = reactApplicationContext.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
            if (displayManager == null) {
                Log.e(TAG, "DisplayManager is null")
                throw Exception("DisplayManager is null")
            }
            
            val display = displayManager.getDisplay(Display.DEFAULT_DISPLAY)
            if (display == null) {
                Log.e(TAG, "Default display is null")
                throw Exception("Default display is null")
            }
            
            val displayMetrics = DisplayMetrics()
            display.getRealMetrics(displayMetrics)
            
            val width = displayMetrics.widthPixels
            val height = displayMetrics.heightPixels
            val density = displayMetrics.densityDpi

            Log.d(TAG, "Display metrics: ${width}x${height}, density: $density")

            if (width <= 0 || height <= 0) {
                Log.e(TAG, "Invalid display dimensions: ${width}x${height}")
                throw Exception("Invalid display dimensions: ${width}x${height}")
            }

            try {
                imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to create ImageReader", e)
                throw Exception("Failed to create ImageReader: ${e.message}")
            }
            
            if (imageReader == null) {
                Log.e(TAG, "ImageReader is null after creation")
                throw Exception("ImageReader is null after creation")
            }

            if (mediaProjection == null) {
                Log.e(TAG, "MediaProjection is null when creating virtual display")
                throw Exception("MediaProjection is null")
            }
            
            try {
                virtualDisplay = mediaProjection!!.createVirtualDisplay(
                    "ScreenCapture",
                    width, height, density,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    imageReader!!.surface, null, null
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to create VirtualDisplay", e)
                throw Exception("Failed to create VirtualDisplay: ${e.message}")
            }

            if (virtualDisplay == null) {
                Log.e(TAG, "VirtualDisplay is null after creation")
                throw Exception("VirtualDisplay is null after creation")
            }

            try {
                imageReader!!.setOnImageAvailableListener({ reader ->
                    Log.v(TAG, "New frame available")
                    sendEvent("ScreenFrameAvailable", null)
                }, Handler(Looper.getMainLooper()))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to set ImageReader listener", e)
                throw Exception("Failed to set ImageReader listener: ${e.message}")
            }
            
            Log.d(TAG, "Virtual display setup completed successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error setting up virtual display", e)
            throw e
        }
    }

    private fun startContinuousCapture() {
        Log.d(TAG, "Starting continuous frame capture")
        
        streamingRunnable = object : Runnable {
            override fun run() {
                if (isStreamingLive && isCapturing) {
                    captureFrame { base64String ->
                        if (base64String != null) {
                            // Send frame to React Native
                            val params = Arguments.createMap()
                            params.putString("frameData", base64String)
                            params.putDouble("timestamp", System.currentTimeMillis().toDouble())
                            sendEvent("LiveFrameCapture", params)
                        }
                    }
                    
                    // Schedule next capture
                    streamingHandler?.postDelayed(this, FRAME_RATE_MS)
                }
            }
        }
        
        streamingHandler?.post(streamingRunnable!!)
    }

    private fun stopContinuousCapture() {
        Log.d(TAG, "Stopping continuous frame capture")
        streamingRunnable?.let { 
            streamingHandler?.removeCallbacks(it)
        }
        streamingRunnable = null
    }

    private fun captureFrame(callback: (String?) -> Unit) {
        if (!isProcessingFrame.compareAndSet(false, true)) {
            // Already processing a frame, skip this one
            callback(null)
            return
        }

        try {
            val image = imageReader?.acquireLatestImage()
            if (image != null) {
                try {
                    val buffer = image.planes[0].buffer
                    val pixelStride = image.planes[0].pixelStride
                    val rowStride = image.planes[0].rowStride
                    val rowPadding = rowStride - pixelStride * image.width

                    val bitmap = Bitmap.createBitmap(
                        image.width + rowPadding / pixelStride,
                        image.height,
                        Bitmap.Config.ARGB_8888
                    )
                    bitmap.copyPixelsFromBuffer(buffer)

                    // Scale down bitmap for better performance but maintain quality
                    val scaledBitmap = Bitmap.createScaledBitmap(bitmap, 
                        (bitmap.width * 0.75).toInt(), (bitmap.height * 0.75).toInt(), true)

                    // Convert bitmap to base64 with higher quality
                    val outputStream = ByteArrayOutputStream()
                    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
                    val byteArray = outputStream.toByteArray()
                    val base64String = Base64.encodeToString(byteArray, Base64.NO_WRAP)

                    bitmap.recycle()
                    scaledBitmap.recycle()
                    
                    callback(base64String)
                } finally {
                    image.close()
                }
            } else {
                callback(null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error capturing frame", e)
            callback(null)
        } finally {
            isProcessingFrame.set(false)
        }
    }

    private fun cleanupResources() {
        Log.d(TAG, "Cleaning up resources")
        
        isCapturing = false
        isStreamingLive = false
        
        stopContinuousCapture()
        
        virtualDisplay?.release()
        virtualDisplay = null
        
        imageReader?.close()
        imageReader = null
        
        // Unregister callback before stopping MediaProjection
        mediaProjectionCallback?.let { callback ->
            mediaProjection?.unregisterCallback(callback)
            Log.d(TAG, "MediaProjection callback unregistered")
        }
        mediaProjectionCallback = null
        
        mediaProjection?.stop()
        mediaProjection = null
        
        // Stop the foreground service
        stopForegroundService()
        
        Log.d(TAG, "Resource cleanup completed")
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending event: $eventName", e)
        }
    }

    private fun startForegroundService() {
        try {
            Log.d(TAG, "Starting foreground service for MediaProjection")
            
            val notificationManager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // Create notification channel for Android 8.0+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channelId = "screen_capture"
                val channelName = "Screen Capture"
                val importance = NotificationManager.IMPORTANCE_LOW
                val channel = NotificationChannel(channelId, channelName, importance).apply {
                    description = "Screen capture service"
                    setShowBadge(false)
                    enableLights(false)
                    enableVibration(false)
                }
                notificationManager.createNotificationChannel(channel)
            }
            
            // Create notification
            val notification = NotificationCompat.Builder(reactApplicationContext, "screen_capture")
                .setContentTitle("Screen Capture")
                .setContentText("Screen capture is active")
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setOngoing(true)
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()
            
            // Start foreground service
            val serviceIntent = Intent(reactApplicationContext, ScreenCaptureService::class.java)
            serviceIntent.putExtra("notification", notification)
            serviceIntent.putExtra("notificationId", 1001)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(serviceIntent)
            } else {
                reactApplicationContext.startService(serviceIntent)
            }
            
            Log.d(TAG, "Foreground service started successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start foreground service", e)
            throw e
        }
    }

    private fun stopForegroundService() {
        try {
            Log.d(TAG, "Stopping foreground service")
            val serviceIntent = Intent(reactApplicationContext, ScreenCaptureService::class.java)
            reactApplicationContext.stopService(serviceIntent)
            Log.d(TAG, "Foreground service stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping foreground service", e)
        }
    }

    companion object {
        private var screenSharePromise: Promise? = null
        private var screenCaptureData: Intent? = null
        private const val TAG = "ScreenSharingModule"
        
        fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
            Log.d(TAG, "handleActivityResult: requestCode=$requestCode, resultCode=$resultCode, data=$data")
            
            if (requestCode == 1000) {
                try {
                    if (resultCode == Activity.RESULT_OK && data != null) {
                        Log.d(TAG, "Screen capture permission granted")
                        screenCaptureData = data
                        screenSharePromise?.resolve(resultCode)
                    } else {
                        Log.w(TAG, "Screen capture permission denied or data is null. ResultCode: $resultCode, Data: $data")
                        screenSharePromise?.reject("PERMISSION_DENIED", "Screen capture permission denied")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling activity result", e)
                    screenSharePromise?.reject("ACTIVITY_RESULT_ERROR", "Error handling permission result: ${e.message}")
                } finally {
                    screenSharePromise = null
                }
            } else {
                Log.d(TAG, "Ignoring activity result for request code: $requestCode")
            }
        }
    }
} 