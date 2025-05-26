package com.myproject

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

class ScreenCaptureService : Service() {
    
    companion object {
        private const val TAG = "ScreenCaptureService"
        private const val NOTIFICATION_ID = 1001
    }
    
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "ScreenCaptureService started")
        
        try {
            val notification = intent?.getParcelableExtra<Notification>("notification")
            val notificationId = intent?.getIntExtra("notificationId", NOTIFICATION_ID) ?: NOTIFICATION_ID
            
            if (notification != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // For Android 10+ (API 29+), specify the foreground service type
                    startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
                } else {
                    startForeground(notificationId, notification)
                }
                Log.d(TAG, "Foreground service started with MediaProjection type")
            } else {
                Log.e(TAG, "No notification provided to foreground service")
                stopSelf()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service", e)
            stopSelf()
        }
        
        return START_STICKY
    }
    
    override fun onDestroy() {
        Log.d(TAG, "ScreenCaptureService destroyed")
        super.onDestroy()
    }
} 