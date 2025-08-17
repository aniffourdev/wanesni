"use client"
import React, { useEffect, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

const APP_ID = 1043089575;
const SERVER_SECRET = "de73ca1d2ccf7ac08c56ddb810ae8c3b";

export default function ZegoVideoCall({ userID, userName, roomID, onCallEnd, onError }) {
  const containerRef = useRef(null);
  const zpRef = useRef(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !userID || !userName || !roomID) {
      setError("Missing required parameters");
      setIsInitializing(false);
      return;
    }

    const initCall = async () => {
      try {
        console.log("=== ZegoUIKit Call Initialization ===");
        console.log("APP_ID:", APP_ID);
        console.log("SERVER_SECRET length:", SERVER_SECRET.length);
        console.log("roomID:", roomID);
        console.log("userID:", userID);
        console.log("userName:", userName);

        // Generate kit token using the test method
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          APP_ID,
          SERVER_SECRET,
          roomID,
          userID,
          userName
        );

        console.log("✅ Kit token generated successfully");
        console.log("Token length:", kitToken.length);

        // Create ZegoUIKit instance
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        console.log("✅ ZegoUIKit instance created");

        // Configure the call with minimal settings
        const callConfig = {
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          showPreJoinView: false,
          showLeavingView: false,
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: true,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: false,
          showTextChat: false,
          showUserList: false,
          showConnectionState: false,
          showSoundWaveInAudioMode: false,
          maxUsers: 2,
          layout: "Auto",
          
          onJoinRoom: () => {
            console.log("✅ Successfully joined room:", roomID);
            setIsInitializing(false);
          },
          
          onLeaveRoom: () => {
            console.log("👋 Left room:", roomID);
            setIsInitializing(false);
            if (onCallEnd) {
              setTimeout(() => onCallEnd(), 100);
            }
          },
          
          onUserJoin: (users) => {
            console.log("👥 Users joined:", users);
          },
          
          onUserLeave: (users) => {
            console.log("👋 Users left:", users);
          },
          
          onError: (errorInfo) => {
            console.error("❌ ZegoUIKit error:", errorInfo);
            const errorMsg = errorInfo.msg || errorInfo.message || JSON.stringify(errorInfo);
            setError(`Call error: ${errorMsg}`);
            setIsInitializing(false);
            
            if (onError) {
              onError(`Call error: ${errorMsg}`);
            }
          }
        };

        console.log("🔗 Joining room with ZegoUIKit...");
        await zp.joinRoom(callConfig);
        console.log("✅ Room join command completed");

      } catch (err) {
        console.error("❌ Call initialization failed:", err);
        
        let errorMessage = "Failed to initialize video call";
        if (err.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.code) {
          errorMessage = `Error code: ${err.code}`;
        }
        
        setError(errorMessage);
        setIsInitializing(false);
        
        if (onError) {
          onError(errorMessage);
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initCall, 200);

    return () => {
      clearTimeout(timer);
      if (zpRef.current) {
        try {
          zpRef.current.destroy();
          console.log("✅ ZegoUIKit destroyed");
        } catch (e) {
          console.error("❌ Error destroying ZegoUIKit:", e);
        }
      }
    };
  }, [userID, userName, roomID, onCallEnd, onError]);

  // Loading state
  if (isInitializing && !error) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #333',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Connecting...</h3>
          <p style={{ margin: 0, opacity: 0.7, fontSize: '16px' }}>
            Setting up video call with {userName}
          </p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '40px',
          borderRadius: '15px',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '20px'
        }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>⚠️</div>
          <h3 style={{ color: '#ff4444', margin: '0 0 15px 0' }}>Video Call Error</h3>
          <p style={{ margin: '0 0 20px 0', opacity: 0.8, fontSize: '16px' }}>{error}</p>
          
          {/* Debug info */}
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            padding: '15px', 
            borderRadius: '8px', 
            margin: '20px 0',
            fontSize: '12px',
            textAlign: 'left'
          }}>
            <strong>Debug Info:</strong><br />
            APP_ID: {APP_ID}<br />
            Server Secret: {SERVER_SECRET ? 'Present' : 'Missing'}<br />
            User ID: {userID}<br />
            Room ID: {roomID}<br />
            User Name: {userName}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
            <button
              onClick={() => onCallEnd && onCallEnd()}
              style={{
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main call container
  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a'
      }}
    />
  );
}