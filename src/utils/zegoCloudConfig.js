// utils/zegoCloudConfig.js
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

const APP_ID = 1043089575;
const SERVER_SECRET = 'de73ca1d2ccf7ac08c56ddb810ae8c3b';

// Generate Kit Token for ZegoCloud
export function generateKitToken(roomID, userID, userName) {
  const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
    APP_ID,
    SERVER_SECRET,
    roomID,
    userID,
    userName
  );
  return kitToken;
}

// Create ZegoCloud instance
export function createZegoInstance(roomID, userID, userName) {
  const kitToken = generateKitToken(roomID, userID, userName);
  
  const zp = ZegoUIKitPrebuilt.create(kitToken);
  
  return zp;
}

// Generate unique room ID
export function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate unique call ID
export function generateCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get video call configuration
export function getVideoCallConfig(userName, onCallEnd) {
  return {
    scenario: {
      mode: ZegoUIKitPrebuilt.VideoConference,
    },
    showScreenSharingButton: true,
    showTextChat: false,
    showUserList: false,
    maxUsers: 2,
    layout: "Auto",
    showLayoutButton: false,
    showPinButton: false,
    showRemoveUserButton: false,
    showTurnOffRemoteCameraButton: false,
    showTurnOffRemoteMicrophoneButton: false,
    onLeaveRoom: onCallEnd,
    onUserLeave: onCallEnd,
    userName: userName,
    userAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff`,
  };
}

// Get audio call configuration
export function getAudioCallConfig(userName, onCallEnd) {
  return {
    scenario: {
      mode: ZegoUIKitPrebuilt.OneONoneCall,
    },
    showScreenSharingButton: false,
    showTextChat: false,
    showUserList: false,
    maxUsers: 2,
    layout: "Auto",
    showLayoutButton: false,
    showPinButton: false,
    showRemoveUserButton: false,
    showTurnOffRemoteCameraButton: false,
    showTurnOffRemoteMicrophoneButton: false,
    showMyMicrophoneToggleButton: true,
    showMyCameraToggleButton: false,
    showAudioVideoSettingsButton: false,
    turnOnMicrophoneWhenJoining: true,
    turnOnCameraWhenJoining: false,
    onLeaveRoom: onCallEnd,
    onUserLeave: onCallEnd,
    userName: userName,
    userAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=10b981&color=fff`,
  };
}