// 'use client';

// import { useRef, useEffect } from 'react';
// import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

// const APP_ID = 1043089575;
// const SERVER_SECRET = 'de73ca1d2ccf7ac08c56ddb810ae8c3b';

// function randomID(len = 5) {
//   const chars = "12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP";
//   let result = "";
//   for (let i = 0; i < len; i++) {
//     result += chars.charAt(Math.floor(Math.random() * chars.length));
//   }
//   return result;
// }

// export default function VideoCall({ roomId, userName }) {
//   const callContainerRef = useRef(null);
//   const zpRef = useRef(null);

//   useEffect(() => {
//     if (!callContainerRef.current || !roomId || !userName) return;

//     console.log('🎥 Starting video call:', { roomId, userName });

//     const userID = randomID(8);

//     // Generate kit token
//     const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
//       APP_ID,
//       SERVER_SECRET,
//       roomId,
//       userID,
//       userName
//     );

//     // Create ZegoUIKit instance
//     const zp = ZegoUIKitPrebuilt.create(kitToken);
//     zpRef.current = zp;

//     // Join the room
//     zp.joinRoom({
//       container: callContainerRef.current,
//       scenario: {
//         mode: ZegoUIKitPrebuilt.OneONoneCall,
//       },
//       showPreJoinView: false,
//       showLeavingView: false,
//       showRoomTimer: true,
//       showUserList: false,
//       showTextChat: false,
//       showScreenSharingButton: true,
//       maxUsers: 2,
//       layout: "Auto",
//       showLayoutButton: false,
//       showPinButton: false,
//       turnOnMicrophoneWhenJoining: true,
//       turnOnCameraWhenJoining: true,
//       showMyCameraToggleButton: true,
//       showMyMicrophoneToggleButton: true,
//       showAudioVideoSettingsButton: true,
//     });

//     console.log('✅ ZegoCloud room joined successfully');

//     // Cleanup function
//     return () => {
//       console.log('🧹 Cleaning up ZegoCloud instance');
//       if (zpRef.current) {
//         try {
//           zpRef.current.destroy();
//         } catch (error) {
//           console.error('Error destroying ZegoCloud instance:', error);
//         }
//         zpRef.current = null;
//       }
//     };
//   }, [roomId, userName]);

//   return (
//     <div
//       ref={callContainerRef}
//       style={{ 
//         width: "100vw", 
//         height: "100vh",
//         backgroundColor: "#000"
//       }}
//     />
//   );
// }


import React from 'react'

const page = () => {
  return (
    <div>page</div>
  )
}

export default page