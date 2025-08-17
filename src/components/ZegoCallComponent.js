'use client';

import { useRef, useEffect } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

const APP_ID = 1043089575;
const SERVER_SECRET = 'de73ca1d2ccf7ac08c56ddb810ae8c3b';

function randomID(len = 5) {
  const chars = "12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function ZegoCallComponent({ 
  roomID, 
  userName, 
  callType = 'video' 
}) {
  const callContainerRef = useRef(null);
  const zpRef = useRef(null);

  useEffect(() => {
    if (!callContainerRef.current || !roomID || !userName) return;

    console.log('🎥 Initializing ZegoCloud call:', { roomID, userName, callType });

    const userID = randomID(8);

    // Generate kit token for authentication
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      APP_ID,
      SERVER_SECRET,
      roomID,
      userID,
      userName
    );

    // Create ZegoUIKit instance
    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zpRef.current = zp;

    // Configure call settings based on call type
    const getCallConfig = () => {
      const baseConfig = {
        container: callContainerRef.current,
        sharedLinks: [
          {
            name: "Share Link",
            url: `${window.location.protocol}//${window.location.host}/video?roomID=${roomID}`,
          },
        ],
        showPreJoinView: false,
        showLeavingView: false,
        showRoomTimer: true,
        showUserList: false,
        showTextChat: false,
        showScreenSharingButton: callType === 'video',
        maxUsers: 2,
        layout: "Auto",
        showLayoutButton: false,
        showPinButton: false,
      };

      if (callType === 'video') {
        return {
          ...baseConfig,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: true,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
        };
      } else {
        // Audio call configuration
        return {
          ...baseConfig,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: false,
          showMyCameraToggleButton: false,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: false,
        };
      }
    };

    const callConfig = getCallConfig();

    // Join the room
    zp.joinRoom(callConfig);

    console.log('✅ ZegoCloud room joined successfully');

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up ZegoCloud instance');
      if (zpRef.current) {
        try {
          zpRef.current.destroy();
        } catch (error) {
          console.error('Error destroying ZegoCloud instance:', error);
        }
        zpRef.current = null;
      }
    };
  }, [roomID, userName, callType]);

  return (
    <div
      ref={callContainerRef}
      style={{ 
        width: "100vw", 
        height: "100vh",
        backgroundColor: "#000"
      }}
    />
  );
}