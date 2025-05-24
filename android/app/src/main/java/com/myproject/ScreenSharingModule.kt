package com.myproject

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import android.view.Display
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
    private val FRAME_RATE_MS = 100L // Capture frame every 100ms (10 FPS)
    
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

            // Create MediaProjection callback
            mediaProjectionCallback = object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.d(TAG, "MediaProjection stopped by callback")
                    cleanupResources()
                    sendEvent("ScreenCaptureStopped", null)
                }
                
                override fun onCapturedContentResize(width: Int, height: Int) {
                    Log.d(TAG, "MediaProjection content resized: ${width}x${height}")
                    // Handle content resize if needed
                }
                
                override fun onCapturedContentVisibilityChanged(isVisible: Boolean) {
                    Log.d(TAG, "MediaProjection content visibility changed: $isVisible")
                    // Handle visibility changes if needed
                }
            }

            // Create media projection from the permission result
            mediaProjection = mediaProjectionManager!!.getMediaProjection(resultCode, screenCaptureData!!)
            
            if (mediaProjection == null) {
                Log.e(TAG, "Failed to create MediaProjection")
                promise.reject("MEDIA_PROJECTION_NULL", "Failed to create MediaProjection")
                return
            }

            // Register the callback BEFORE starting capture (required for API 34+)
            mediaProjection!!.registerCallback(mediaProjectionCallback!!, Handler(Looper.getMainLooper()))
            Log.d(TAG, "MediaProjection callback registered")

            setupVirtualDisplay()
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
            
            val displayManager = reactApplicationContext.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
            val display = displayManager.getDisplay(Display.DEFAULT_DISPLAY)
            
            if (display == null) {
                Log.e(TAG, "Default display is null")
                return
            }
            
            val displayMetrics = DisplayMetrics()
            display.getRealMetrics(displayMetrics)
            
            val width = displayMetrics.widthPixels
            val height = displayMetrics.heightPixels
            val density = displayMetrics.densityDpi

            Log.d(TAG, "Display metrics: ${width}x${height}, density: $density")

            imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)
            
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "ScreenCapture",
                width, height, density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader!!.surface, null, null
            )

            imageReader?.setOnImageAvailableListener({ reader ->
                // Image is available for processing
                Log.v(TAG, "New frame available")
                sendEvent("ScreenFrameAvailable", null)
            }, Handler(Looper.getMainLooper()))
            
            Log.d(TAG, "Virtual display setup completed")
            
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

                    // Scale down bitmap for better performance (optional)
                    val scaledBitmap = Bitmap.createScaledBitmap(bitmap, 
                        bitmap.width / 2, bitmap.height / 2, true)

                    // Convert bitmap to base64
                    val outputStream = ByteArrayOutputStream()
                    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 70, outputStream)
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

    companion object {
        private var screenSharePromise: Promise? = null
        private var screenCaptureData: Intent? = null
        private const val TAG = "ScreenSharingModule"
        
        fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
            Log.d(TAG, "handleActivityResult: requestCode=$requestCode, resultCode=$resultCode")
            
            if (requestCode == 1000) {
                if (resultCode == Activity.RESULT_OK && data != null) {
                    Log.d(TAG, "Screen capture permission granted")
                    screenCaptureData = data
                    screenSharePromise?.resolve(resultCode)
                } else {
                    Log.w(TAG, "Screen capture permission denied")
                    screenSharePromise?.reject("PERMISSION_DENIED", "Screen capture permission denied")
                }
                screenSharePromise = null
            }
        }
    }
} 