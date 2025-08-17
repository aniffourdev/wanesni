'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

const BACKEND_URL = 'https://wanesni.com';

// Mock functions for ZegoCloud - replace these with actual ZegoCloud imports
const generateRoomId = () => `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateCallId = () => `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Mock ZegoCloud functions - you'll need to replace these with actual ZegoCloud implementation
const createZegoInstance = (roomId, userId, userName) => {
  console.log('Creating Zego instance for:', { roomId, userId, userName });
  return {
    joinRoom: async (config) => {
      console.log('Joining room with config:', config);
      return Promise.resolve();
    },
    destroy: async () => {
      console.log('Destroying Zego instance');
      return Promise.resolve();
    }
  };
};

const getVideoCallConfig = (userName, endCallCallback) => ({
  scenario: {
    mode: 'OneONoneCall',
  },
  showRoomTimer: true,
  showUserList: false,
  maxUsers: 2,
  layout: 'Grid',
  showLayoutButton: false,
  onLeaveRoom: endCallCallback,
});

const getAudioCallConfig = (userName, endCallCallback) => ({
  scenario: {
    mode: 'OneONoneCall',
  },
  showRoomTimer: true,
  showUserList: false,
  maxUsers: 2,
  layout: 'Grid',
  showLayoutButton: false,
  turnOnCameraWhenJoining: false,
  showToggleCameraButton: false,
  showToggleMicrophoneButton: true,
  onLeaveRoom: endCallCallback,
});

export default function VideoCallComponent({ 
  socket, 
  callType = 'video', 
  onCallEnd, 
  otherUser = null,
  conversationId = null,
  initialCallData = null 
}) {
  const { user, apiCall } = useAuth();
  const [callStatus, setCallStatus] = useState('initializing'); // initializing, calling, ringing, connected, ended
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [roomId, setRoomId] = useState('');
  const [callId, setCallId] = useState('');
  const [isCalleeMode, setIsCalleeMode] = useState(false);
  const [showZegoUI, setShowZegoUI] = useState(false);
  
  const zegoContainerRef = useRef(null);
  const zegoInstanceRef = useRef(null);
  const callTimerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const incomingRingtoneRef = useRef(null);

  // Initialize call
  useEffect(() => {
    if (initialCallData) {
      // This is an incoming call
      setIsCalleeMode(true);
      setRoomId(initialCallData.roomId);
      setCallId(initialCallData.callId);
      setCallStatus('ringing');
      playIncomingRingtone();
    } else {
      // This is an outgoing call
      setIsCalleeMode(false);
      const newRoomId = generateRoomId();
      const newCallId = generateCallId();
      setRoomId(newRoomId);
      setCallId(newCallId);
      setCallStatus('calling');
      initiateCall(newCallId, newRoomId);
    }

    return () => {
      cleanup();
    };
  }, [initialCallData]);

  // Start call timer
  useEffect(() => {
    if (callStatus === 'connected' && !callTimerRef.current) {
      setCallStartTime(Date.now());
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    if (callStatus === 'ended' && callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, [callStatus]);

  // Play ringtones
  const playOutgoingRingtone = () => {
    try {
      ringtoneRef.current = new Audio('/sounds/ringtone.mp3');
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch(e => console.log('Ringtone play failed:', e));
    } catch (error) {
      console.log('Ringtone not available:', error);
    }
  };

  const playIncomingRingtone = () => {
    try {
      incomingRingtoneRef.current = new Audio('/sounds/incoming-call.mp3');
      incomingRingtoneRef.current.loop = true;
      incomingRingtoneRef.current.play().catch(e => console.log('Incoming ringtone play failed:', e));
    } catch (error) {
      console.log('Incoming ringtone not available:', error);
    }
  };

  const stopRingtones = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    if (incomingRingtoneRef.current) {
      incomingRingtoneRef.current.pause();
      incomingRingtoneRef.current.currentTime = 0;
    }
  };

  // Initiate outgoing call
  const initiateCall = async (callId, roomId) => {
    if (!socket || !user || !otherUser) return;

    try {
      playOutgoingRingtone();

      // Send call offer via socket
      socket.emit('callOffer', {
        callId,
        roomId,
        callerId: user.id,
        callerName: `${user.first_name} ${user.last_name || ''}`.trim(),
        calleeId: otherUser.id,
        calleeName: `${otherUser.first_name} ${otherUser.last_name || ''}`.trim(),
        callType,
        conversationId
      });

      // Save call to database
      await saveCallToDatabase(callId, roomId, 'initiated');

      // Listen for call responses
      socket.on('callAccepted', handleCallAccepted);
      socket.on('callRejected', handleCallRejected);
      socket.on('callEnded', handleCallEnded);

    } catch (error) {
      console.error('Error initiating call:', error);
      endCall();
    }
  };

  // Accept incoming call
  const acceptCall = () => {
    if (!socket || !initialCallData) return;

    stopRingtones();
    setCallStatus('connecting');

    socket.emit('callAccepted', {
      callId: initialCallData.callId,
      roomId: initialCallData.roomId,
      calleeId: user.id,
      calleeName: `${user.first_name} ${user.last_name || ''}`.trim()
    });

    joinZegoRoom();
  };

  // Reject incoming call
  const rejectCall = () => {
    if (!socket || !initialCallData) return;

    stopRingtones();
    setCallStatus('ended');

    socket.emit('callRejected', {
      callId: initialCallData.callId,
      roomId: initialCallData.roomId,
      calleeId: user.id
    });

    onCallEnd && onCallEnd();
  };

  // Handle call accepted
  const handleCallAccepted = (data) => {
    stopRingtones();
    setCallStatus('connecting');
    joinZegoRoom();
  };

  // Handle call rejected
  const handleCallRejected = (data) => {
    stopRingtones();
    setCallStatus('ended');
    setTimeout(() => {
      onCallEnd && onCallEnd();
    }, 2000);
  };

  // Handle call ended
  const handleCallEnded = (data) => {
    endCall();
  };

  // Join ZegoCloud room
  const joinZegoRoom = async () => {
    if (!user || !roomId) return;

    try {
      const userName = `${user.first_name} ${user.last_name || ''}`.trim();
      const zp = createZegoInstance(roomId, user.id.toString(), userName);
      
      const config = callType === 'video' 
        ? getVideoCallConfig(userName, endCall)
        : getAudioCallConfig(userName, endCall);

      setShowZegoUI(true);
      zegoInstanceRef.current = zp;

      // Join room
      await zp.joinRoom({
        container: zegoContainerRef.current,
        ...config
      });

      setCallStatus('connected');

      // Update call status in database
      await updateCallStatus('connected');

    } catch (error) {
      console.error('Error joining room:', error);
      endCall();
    }
  };

  // End call
  const endCall = async () => {
    stopRingtones();
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (zegoInstanceRef.current) {
      try {
        await zegoInstanceRef.current.destroy();
      } catch (error) {
        console.log('Error destroying zego instance:', error);
      }
      zegoInstanceRef.current = null;
    }

    if (socket) {
      socket.emit('callEnded', {
        callId,
        roomId,
        userId: user?.id
      });
      
      // Remove listeners
      socket.off('callAccepted', handleCallAccepted);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
    }

    // Update call status in database
    await updateCallStatus('ended');

    setCallStatus('ended');
    setShowZegoUI(false);
    
    setTimeout(() => {
      onCallEnd && onCallEnd();
    }, 1000);
  };

  // Save call to database
  const saveCallToDatabase = async (callId, roomId, status) => {
    if (!user || !otherUser) return;

    try {
      const callData = {
        call_id: callId,
        room_id: roomId,
        caller_id: user.id,
        callee_id: otherUser.id,
        call_type: callType,
        call_status: status,
        start_time: new Date().toISOString()
      };

      const response = await apiCall(`${BACKEND_URL}/items/video_calls`, {
        method: 'POST',
        body: JSON.stringify(callData)
      });

      if (!response.ok) {
        console.error('Failed to save call:', response.status);
      }
    } catch (error) {
      console.error('Error saving call:', error);
    }
  };

  // Update call status
  const updateCallStatus = async (status) => {
    if (!callId) return;

    try {
      const updateData = {
        call_status: status
      };

      if (status === 'ended' && callDuration > 0) {
        updateData.duration = callDuration;
      }

      const response = await apiCall(`${BACKEND_URL}/items/video_calls?filter[call_id][_eq]=${callId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        console.error('Failed to update call status:', response.status);
      }
    } catch (error) {
      console.error('Error updating call status:', error);
    }
  };

  // Cleanup
  const cleanup = () => {
    stopRingtones();
    
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (zegoInstanceRef.current) {
      zegoInstanceRef.current.destroy().catch(console.error);
      zegoInstanceRef.current = null;
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status message
  const getStatusMessage = () => {
    switch (callStatus) {
      case 'initializing':
        return 'Initializing call...';
      case 'calling':
        return `Calling ${otherUser?.first_name}...`;
      case 'ringing':
        return `Incoming ${callType} call from ${initialCallData?.callerName}`;
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return `${callType === 'video' ? 'Video' : 'Audio'} call - ${formatDuration(callDuration)}`;
      case 'ended':
        return 'Call ended';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      {/* ZegoCloud UI Container */}
      {showZegoUI && (
        <div 
          ref={zegoContainerRef}
          className="w-full h-full"
        />
      )}

      {/* Custom Call UI (shown when not in ZegoCloud UI) */}
      {!showZegoUI && (
        <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
          {/* Call Status */}
          <div className="text-center mb-8">
            <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
              {callType === 'video' ? (
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              )}
            </div>

            <h2 className="text-2xl font-bold mb-2">
              {isCalleeMode 
                ? initialCallData?.callerName 
                : otherUser?.first_name || 'Unknown User'
              }
            </h2>
            
            <p className="text-lg text-gray-300 mb-4">
              {getStatusMessage()}
            </p>

            {callStatus === 'calling' && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div className="flex items-center space-x-6">
            {callStatus === 'ringing' && isCalleeMode && (
              <>
                {/* Accept Call */}
                <button
                  onClick={acceptCall}
                  className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110 animate-pulse"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>

                {/* Reject Call */}
                <button
                  onClick={rejectCall}
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l1.5 1.5M4.5 4.5l15 15" />
                  </svg>
                </button>
              </>
            )}

            {(callStatus === 'calling' || callStatus === 'connecting' || callStatus === 'connected') && (
              <button
                onClick={endCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l1.5 1.5M4.5 4.5l15 15" />
                </svg>
              </button>
            )}
          </div>

          {callStatus === 'ended' && (
            <div className="text-center mt-8">
              <p className="text-gray-300">
                {callDuration > 0 
                  ? `Call duration: ${formatDuration(callDuration)}`
                  : 'Call ended'
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}