// "use client";
// import React, { useState, useEffect } from 'react';
// import { useSearchParams } from 'next/navigation';
// import io from 'socket.io-client';
// import dynamic from 'next/dynamic';

// // Import ZegoVideoCall with no SSR to avoid document errors
// const ZegoVideoCallClient = dynamic(() => import('@/components/videos/ZegoVideoCallClient'), { 
//   ssr: false 
// });

// export default function VideoCallPage() {
//   const searchParams = useSearchParams();
//   const [socket, setSocket] = useState(null);
//   const [currentUser, setCurrentUser] = useState(null);
//   const [onlineUsers, setOnlineUsers] = useState([]);
//   const [callState, setCallState] = useState('idle'); // idle, searching, calling, in_call
//   const [callData, setCallData] = useState(null);
//   const [incomingCall, setIncomingCall] = useState(null);
//   const [error, setError] = useState(null);
//   const [isConnecting, setIsConnecting] = useState(true);

//   // Initialize socket connection and user
//   useEffect(() => {
//     // Get user data from URL params or generate fallback
//     const urlUserID = searchParams.get('userID');
//     const urlUserName = searchParams.get('userName');
    
//     // Use real user ID if provided, otherwise generate one
//     const userID = urlUserID || generateUserID();
//     const userName = urlUserName || 'Anonymous User';
    
//     // Set current user
//     const user = {
//       id: userID,
//       name: userName,
//       isLookingForRandomCall: false
//     };
//     setCurrentUser(user);

//     // Initialize socket connection
//     const socketInstance = io('wss://socket.wanesni.com', {
//       transports: ['websocket', 'polling']
//     });

//     socketInstance.on('connect', () => {
//       console.log('Connected to socket server');
//       // Initialize user on socket server with proper data
//       socketInstance.emit('init', {
//         userId: userID,
//         firstName: userName.split(' ')[0] || userName,
//         lastName: userName.split(' ').slice(1).join(' ') || ''
//       });
//       setIsConnecting(false);
//     });

//     socketInstance.on('disconnect', () => {
//       console.log('Disconnected from socket server');
//       setIsConnecting(true);
//     });

//     // Handle online users updates
//     socketInstance.on('onlineUsers', (users) => {
//       console.log('Online users updated:', users);
//       setOnlineUsers(users.filter(u => u.id !== userID)); // Exclude current user
//     });

//     // Handle incoming call
//     socketInstance.on('incomingCall', (data) => {
//       console.log('Incoming call:', data);
//       setIncomingCall(data);
//       setCallState('calling');
//     });

//     // Handle call accepted
//     socketInstance.on('callAccepted', (data) => {
//       console.log('Call accepted:', data);
//       setCallData({
//         roomID: data.callId,
//         userID: currentUser?.id || userID,
//         userName: currentUser?.name || userName,
//         callType: 'video',
//         isPrivate: true,
//         otherUser: {
//           id: data.calleeId,
//           name: data.calleeName
//         }
//       });
//       setCallState('in_call');
//       setIncomingCall(null);
//     });

//     // Handle call rejected
//     socketInstance.on('callRejected', (data) => {
//       console.log('Call rejected:', data);
//       setError(`Call ${data.reason}: ${data.calleeName}`);
//       setCallState('idle');
//       setIncomingCall(null);
//     });

//     // Handle call ended
//     socketInstance.on('callEnded', (data) => {
//       console.log('Call ended:', data);
//       setCallState('idle');
//       setCallData(null);
//       setIncomingCall(null);
//     });

//     // Handle call failed
//     socketInstance.on('callFailed', (data) => {
//       console.log('Call failed:', data);
//       setError(`Call failed: ${data.reason}`);
//       setCallState('idle');
//     });

//     setSocket(socketInstance);

//     return () => {
//       socketInstance.disconnect();
//     };
//   }, [searchParams]);

//   // Generate random user ID
//   function generateUserID() {
//     return `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
//   }

//   // Generate random room ID
//   function generateRoomID() {
//     const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
//     let result = "";
//     for (let i = 0; i < 8; i++) {
//       result += chars.charAt(Math.floor(Math.random() * chars.length));
//     }
//     return `room_${result}`;
//   }

//   // Start random call search
//   const startRandomCall = () => {
//     if (!socket || !currentUser) return;
    
//     setCallState('searching');
//     setError(null);
    
//     // Mark user as looking for random call
//     const updatedUser = { ...currentUser, isLookingForRandomCall: true };
//     setCurrentUser(updatedUser);
    
//     // Emit to socket that user is looking for random call
//     socket.emit('lookingForRandomCall', {
//       userId: currentUser.id,
//       userName: currentUser.name,
//       isLooking: true
//     });
    
//     console.log('Started looking for random call...');
//   };

//   // Handle random call match from socket
//   useEffect(() => {
//     if (!socket) return;

//     // Listen for random call matches
//     socket.on('randomCallMatched', (data) => {
//       console.log('Random call matched:', data);
      
//       // Automatically start call with matched user
//       setCallData({
//         roomID: data.roomId,
//         userID: currentUser.id,
//         userName: currentUser.name,
//         callType: 'video',
//         isPrivate: false,
//         otherUser: {
//           id: data.otherUserId,
//           name: data.otherUserName
//         }
//       });
//       setCallState('in_call');
      
//       // Stop looking for random call
//       const updatedUser = { ...currentUser, isLookingForRandomCall: false };
//       setCurrentUser(updatedUser);
//     });

//     return () => {
//       socket.off('randomCallMatched');
//     };
//   }, [socket, currentUser]);

//   // Make a call (private or random)
//   const makeCall = (targetUserId, targetUserName, callType = 'private') => {
//     if (!socket || !currentUser) return;

//     const callId = generateRoomID();
//     const callData = {
//       callId,
//       roomId: callId,
//       callerId: currentUser.id,
//       callerName: currentUser.name,
//       calleeId: targetUserId,
//       callType: 'video',
//       conversationId: `${currentUser.id}_${targetUserId}` // Simple conversation ID
//     };

//     console.log('Making call:', callData);
//     socket.emit('callOffer', callData);
//     setCallState('calling');
//   };

//   // Accept incoming call
//   const acceptCall = () => {
//     if (!socket || !incomingCall) return;

//     socket.emit('callResponse', {
//       callId: incomingCall.callId,
//       response: 'accepted',
//       callerId: incomingCall.callerId
//     });

//     setCallData({
//       roomID: incomingCall.roomId,
//       userID: currentUser.id,
//       userName: currentUser.name,
//       callType: 'video',
//       isPrivate: true,
//       otherUser: {
//         id: incomingCall.callerId,
//         name: incomingCall.callerName
//       }
//     });
//     setCallState('in_call');
//     setIncomingCall(null);
//   };

//   // Reject incoming call
//   const rejectCall = () => {
//     if (!socket || !incomingCall) return;

//     socket.emit('callResponse', {
//       callId: incomingCall.callId,
//       response: 'rejected',
//       callerId: incomingCall.callerId
//     });

//     setIncomingCall(null);
//     setCallState('idle');
//   };

//   // End current call
//   const endCall = () => {
//     if (!socket || !callData) return;

//     socket.emit('callEnded', {
//       callId: callData.roomID,
//       reason: 'user_ended'
//     });

//     setCallState('idle');
//     setCallData(null);
//     setIncomingCall(null);
//   };

//   // Stop searching for random call
//   const stopSearching = () => {
//     if (socket && currentUser) {
//       // Emit to socket that user stopped looking
//       socket.emit('lookingForRandomCall', {
//         userId: currentUser.id,
//         userName: currentUser.name,
//         isLooking: false
//       });
      
//       // Update local state
//       const updatedUser = { ...currentUser, isLookingForRandomCall: false };
//       setCurrentUser(updatedUser);
//     }
    
//     setCallState('idle');
//     setError(null);
//   };

//   // Clear error
//   const clearError = () => {
//     setError(null);
//   };

//   // Render based on call state
//   if (callState === 'in_call' && callData) {
//     return (
//       <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
//         <ZegoVideoCallClient
//           userID={callData.userID}
//           userName={callData.userName}
//           roomID={callData.roomID}
//           onCallEnd={endCall}
//         />
//       </div>
//     );
//   }

//   // Main interface
//   return (
//     <div style={{
//       width: '100vw',
//       height: '100vh',
//       backgroundColor: '#1a1a1a',
//       color: '#fff',
//       fontFamily: 'Arial, sans-serif',
//       display: 'flex',
//       flexDirection: 'column'
//     }}>
//       {/* Header */}
//       <div style={{
//         padding: '20px',
//         borderBottom: '1px solid #333',
//         display: 'flex',
//         justifyContent: 'space-between',
//         alignItems: 'center'
//       }}>
//         <h1 style={{ margin: 0, fontSize: '24px' }}>Video Call</h1>
//         <div style={{ fontSize: '14px', opacity: 0.7 }}>
//           {isConnecting ? 'Connecting...' : `${onlineUsers.length} users online`}
//         </div>
//       </div>

//       {/* Error Display */}
//       {error && (
//         <div style={{
//           backgroundColor: '#ff4444',
//           color: '#fff',
//           padding: '15px 20px',
//           display: 'flex',
//           justifyContent: 'space-between',
//           alignItems: 'center'
//         }}>
//           <span>{error}</span>
//           <button
//             onClick={clearError}
//             style={{
//               background: 'none',
//               border: 'none',
//               color: '#fff',
//               fontSize: '18px',
//               cursor: 'pointer'
//             }}
//           >
//             ✕
//           </button>
//         </div>
//       )}

//       {/* Incoming Call Modal */}
//       {incomingCall && (
//         <div style={{
//           position: 'fixed',
//           top: 0,
//           left: 0,
//           width: '100vw',
//           height: '100vh',
//           backgroundColor: 'rgba(0,0,0,0.9)',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'center',
//           zIndex: 1000
//         }}>
//           <div style={{
//             backgroundColor: '#2a2a2a',
//             padding: '40px',
//             borderRadius: '20px',
//             textAlign: 'center',
//             maxWidth: '400px',
//             margin: '20px'
//           }}>
//             <div style={{ fontSize: '60px', marginBottom: '20px' }}>📞</div>
//             <h2 style={{ margin: '0 0 10px 0' }}>Incoming Call</h2>
//             <p style={{ margin: '0 0 30px 0', fontSize: '18px' }}>
//               {incomingCall.callerName} is calling you
//             </p>
//             <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
//               <button
//                 onClick={acceptCall}
//                 style={{
//                   backgroundColor: '#4CAF50',
//                   color: '#fff',
//                   border: 'none',
//                   padding: '15px 30px',
//                   borderRadius: '50px',
//                   fontSize: '16px',
//                   cursor: 'pointer',
//                   display: 'flex',
//                   alignItems: 'center',
//                   gap: '10px'
//                 }}
//               >
//                 ✅ Accept
//               </button>
//               <button
//                 onClick={rejectCall}
//                 style={{
//                   backgroundColor: '#f44336',
//                   color: '#fff',
//                   border: 'none',
//                   padding: '15px 30px',
//                   borderRadius: '50px',
//                   fontSize: '16px',
//                   cursor: 'pointer',
//                   display: 'flex',
//                   alignItems: 'center',
//                   gap: '10px'
//                 }}
//               >
//                 ❌ Decline
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Main Content */}
//       <div style={{
//         flex: 1,
//         display: 'flex',
//         overflow: 'hidden'
//       }}>
//         {/* Left Panel - Random Call */}
//         <div style={{
//           width: '350px',
//           backgroundColor: '#2a2a2a',
//           padding: '30px',
//           borderRight: '1px solid #333'
//         }}>
//           <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Random Call</h2>
//           <p style={{ margin: '0 0 30px 0', opacity: 0.7, fontSize: '14px' }}>
//             Connect with a random user for video chat
//           </p>

//           {callState === 'searching' ? (
//             <div style={{ textAlign: 'center' }}>
//               <div style={{
//                 width: '60px',
//                 height: '60px',
//                 border: '4px solid #444',
//                 borderTop: '4px solid #007bff',
//                 borderRadius: '50%',
//                 animation: 'spin 1s linear infinite',
//                 margin: '0 auto 20px'
//               }}></div>
//               <p style={{ margin: '0 0 20px 0' }}>Searching for users...</p>
//               <button
//                 onClick={stopSearching}
//                 style={{
//                   backgroundColor: '#f44336',
//                   color: '#fff',
//                   border: 'none',
//                   padding: '12px 24px',
//                   borderRadius: '8px',
//                   fontSize: '14px',
//                   cursor: 'pointer'
//                 }}
//               >
//                 Cancel Search
//               </button>
//             </div>
//           ) : (
//             <button
//               onClick={startRandomCall}
//               disabled={isConnecting || onlineUsers.length === 0}
//               style={{
//                 width: '100%',
//                 backgroundColor: onlineUsers.length > 0 ? '#007bff' : '#666',
//                 color: '#fff',
//                 border: 'none',
//                 padding: '15px',
//                 borderRadius: '12px',
//                 fontSize: '16px',
//                 cursor: onlineUsers.length > 0 ? 'pointer' : 'not-allowed',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 gap: '10px'
//               }}
//             >
//               🎲 Start Random Call
//             </button>
//           )}

//           <style jsx>{`
//             @keyframes spin {
//               0% { transform: rotate(0deg); }
//               100% { transform: rotate(360deg); }
//             }
//           `}</style>
//         </div>

//         {/* Right Panel - Online Users */}
//         <div style={{
//           flex: 1,
//           padding: '30px',
//           overflow: 'auto'
//         }}>
//           <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Online Users</h2>
          
//           {isConnecting ? (
//             <p style={{ opacity: 0.7 }}>Connecting to server...</p>
//           ) : onlineUsers.length === 0 ? (
//             <p style={{ opacity: 0.7 }}>No other users online</p>
//           ) : (
//             <div style={{
//               display: 'grid',
//               gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
//               gap: '20px'
//             }}>
//               {onlineUsers.map((user) => (
//                 <div
//                   key={user.id}
//                   style={{
//                     backgroundColor: '#2a2a2a',
//                     padding: '20px',
//                     borderRadius: '12px',
//                     display: 'flex',
//                     alignItems: 'center',
//                     justifyContent: 'space-between'
//                   }}
//                 >
//                   <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
//                     <div style={{
//                       width: '50px',
//                       height: '50px',
//                       borderRadius: '50%',
//                       backgroundColor: '#007bff',
//                       display: 'flex',
//                       alignItems: 'center',
//                       justifyContent: 'center',
//                       fontSize: '20px'
//                     }}>
//                       {user.avatar ? (
//                         <img 
//                           src={user.avatar} 
//                           alt={user.fullName}
//                           style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
//                         />
//                       ) : (
//                         '👤'
//                       )}
//                     </div>
//                     <div>
//                       <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
//                         {user.fullName || `${user.first_name} ${user.last_name}`.trim()}
//                       </div>
//                       <div style={{ 
//                         fontSize: '12px', 
//                         opacity: 0.7,
//                         color: user.isInCall ? '#ff9800' : '#4CAF50'
//                       }}>
//                         {user.isInCall ? `In Call (${user.callStatus})` : 'Available'}
//                       </div>
//                     </div>
//                   </div>
                  
//                   <button
//                     onClick={() => makeCall(user.id, user.fullName || `${user.first_name} ${user.last_name}`.trim())}
//                     disabled={user.isInCall || callState !== 'idle'}
//                     style={{
//                       backgroundColor: user.isInCall ? '#666' : '#4CAF50',
//                       color: '#fff',
//                       border: 'none',
//                       padding: '10px',
//                       borderRadius: '50%',
//                       width: '45px',
//                       height: '45px',
//                       cursor: user.isInCall ? 'not-allowed' : 'pointer',
//                       fontSize: '18px',
//                       display: 'flex',
//                       alignItems: 'center',
//                       justifyContent: 'center'
//                     }}
//                     title={user.isInCall ? 'User is busy' : 'Call this user'}
//                   >
//                     📞
//                   </button>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

import React from 'react'

const page = () => {
  return (
    <div>page</div>
  )
}

export default page