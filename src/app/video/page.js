'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import io from 'socket.io-client';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues
const CustomVideoCall = dynamic(() => import('@/components/videoCallSDK'), { 
  ssr: false 
});

const SOCKET_URL = 'wss://socket.wanesni.com';
const BACKEND_URL = 'https://wanesni.com';

export default function VideoPage() {
  const { user, apiCall } = useAuth();
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'error'
  const [retryCount, setRetryCount] = useState(0);
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const initTimeoutRef = useRef(null);

  // Initialize socket connection with better error handling
  useEffect(() => {
    if (!user) {
      console.log('❌ No user found, cannot connect socket');
      return;
    }

    console.log('🔌 Starting socket connection for user:', user.id);
    connectSocket();

    return () => {
      cleanup();
    };
  }, [user]);

  const connectSocket = () => {
    if (socketRef.current) {
      console.log('🧹 Cleaning up existing socket');
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }

    setConnectionStatus('connecting');
    console.log('🔄 Attempting socket connection...');

    try {
      const newSocket = io(SOCKET_URL, {
        auth: { 
          token: localStorage.getItem('access_token') || '',
          userId: user.id,
          timestamp: Date.now()
        },
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true,
        reconnection: false // We'll handle reconnection manually
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connection successful
      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id);
        setConnectionStatus('connected');
        setRetryCount(0);
        
        // Initialize user after connection
        console.log('👤 Initializing user...');
        newSocket.emit('init', {
          userId: user.id,
          firstName: user.first_name || user.id,
          lastName: user.last_name || '',
          email: user.email || ''
        });

        // Set a timeout to ensure initialization completes
        initTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Init timeout - broadcasting users request');
          newSocket.emit('requestOnlineUsers');
        }, 3000);
      });

      // Connection error
      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message);
        setConnectionStatus('error');
        
        // Retry with exponential backoff
        const nextRetryCount = retryCount + 1;
        if (nextRetryCount <= 5) {
          const delay = Math.min(1000 * Math.pow(2, nextRetryCount), 10000);
          console.log(`🔄 Retrying connection in ${delay}ms... (attempt ${nextRetryCount})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setRetryCount(nextRetryCount);
            connectSocket();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
        }
      });

      // Disconnection
      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setConnectionStatus('disconnected');
        
        // Auto-reconnect unless it was intentional
        if (reason !== 'io client disconnect' && retryCount < 5) {
          const delay = 2000;
          console.log(`🔄 Auto-reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSocket();
          }, delay);
        }
      });

      // Listen for online users
      newSocket.on('onlineUsers', (usersList) => {
        console.log('👥 Received online users update:', usersList.length, 'users');
        const filteredUsers = Array.isArray(usersList) 
          ? usersList.filter(u => u && u.id && u.id !== user.id) 
          : [];
        setOnlineUsers(filteredUsers);
        
        // Clear init timeout since we got the users list
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
      });

      // Listen for incoming calls
      newSocket.on('incomingCall', (data) => {
        console.log('📞 Incoming call:', data);
        if (data && data.callId && data.callerName) {
          setIncomingCall(data);
        }
      });

      // Listen for call accepted
      newSocket.on('callAccepted', (data) => {
        console.log('✅ Call accepted:', data);
        if (data && data.callId) {
          setActiveCall({
            roomId: data.roomId || `room_${data.callId}`,
            callId: data.callId,
            isInitiator: true,
            otherUser: {
              id: data.calleeId,
              name: data.calleeName,
              avatar: data.calleeAvatar
            }
          });
          setIncomingCall(null);
        }
      });

      // Listen for call rejected
      newSocket.on('callRejected', (data) => {
        console.log('❌ Call rejected:', data);
        const message = data.reason === 'busy' 
          ? `${data.calleeName || 'User'} is currently busy`
          : `${data.calleeName || 'User'} declined the call`;
        alert(message);
        setIncomingCall(null);
      });

      // Listen for call ended
      newSocket.on('callEnded', (data) => {
        console.log('📴 Call ended:', data);
        setActiveCall(null);
        setIncomingCall(null);
      });

      // Listen for call failed
      newSocket.on('callFailed', (data) => {
        console.error('📞 Call failed:', data);
        alert(`Call failed: ${data.reason}`);
      });

      // Listen for errors
      newSocket.on('error', (error) => {
        console.error('🚨 Socket error:', error);
      });

    } catch (error) {
      console.error('❌ Failed to create socket:', error);
      setConnectionStatus('error');
    }
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up video page...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setSocket(null);
    setConnectionStatus('disconnected');
  };

  // Fetch users list
  useEffect(() => {
    if (!user || !apiCall) return;

    const fetchUsers = async () => {
      try {
        console.log('📋 Fetching users list...');
        const response = await apiCall(`${BACKEND_URL}/users`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.data || []);
          console.log('✅ Users list fetched:', data.data?.length || 0, 'users');
        }
      } catch (error) {
        console.error('❌ Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [user, apiCall]);

  // Call user function
  const callUser = (targetUser) => {
    if (!socket || connectionStatus !== 'connected' || !user) {
      alert('Connection not ready. Please wait a moment and try again.');
      return;
    }

    if (!targetUser || !targetUser.id) {
      alert('Invalid user selected.');
      return;
    }

    if (targetUser.isInCall) {
      alert(`${targetUser.first_name || 'User'} is currently in another call.`);
      return;
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('📞 Initiating call...', {
      callId,
      roomId,
      targetUser: targetUser.first_name,
      targetUserId: targetUser.id
    });

    socket.emit('callOffer', {
      callId,
      roomId,
      callerId: user.id,
      callerName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.id,
      calleeId: targetUser.id,
      callType: 'video'
    });

    console.log(`📞 Calling ${targetUser.first_name || targetUser.id}...`);
  };

  // Accept call function
  const acceptCall = () => {
    if (!socket || !incomingCall) {
      console.error('❌ Cannot accept call - missing socket or incoming call data');
      return;
    }

    console.log('✅ Accepting call...', incomingCall);

    socket.emit('callResponse', {
      callId: incomingCall.callId,
      response: 'accepted',
      callerId: incomingCall.callerId
    });

    setActiveCall({
      roomId: incomingCall.roomId,
      callId: incomingCall.callId,
      isInitiator: false,
      otherUser: {
        id: incomingCall.callerId,
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar
      }
    });
    setIncomingCall(null);
  };

  // Reject call function
  const rejectCall = () => {
    if (!socket || !incomingCall) {
      console.error('❌ Cannot reject call - missing socket or incoming call data');
      return;
    }

    console.log('❌ Rejecting call...', incomingCall);

    socket.emit('callResponse', {
      callId: incomingCall.callId,
      response: 'rejected',
      callerId: incomingCall.callerId
    });

    setIncomingCall(null);
  };

  // End call function
  const endCall = () => {
    if (!socket || !activeCall) {
      console.error('❌ Cannot end call - missing socket or active call data');
      return;
    }

    console.log('📴 Ending call...', activeCall);

    socket.emit('callEnded', {
      callId: activeCall.callId,
      reason: 'ended_by_user'
    });

    setActiveCall(null);
  };

  // Retry connection manually
  const retryConnection = () => {
    setRetryCount(0);
    connectSocket();
  };

  // Loading state - no user
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p>Please log in to access video calls</p>
        </div>
      </div>
    );
  }

  // Connection status display
  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return {
          icon: '🔄',
          text: 'Connecting...',
          color: 'text-yellow-400',
          bg: 'bg-yellow-500'
        };
      case 'connected':
        return {
          icon: '✅',
          text: 'Connected',
          color: 'text-green-400',
          bg: 'bg-green-500'
        };
      case 'error':
        return {
          icon: '❌',
          text: 'Connection Error',
          color: 'text-red-400',
          bg: 'bg-red-500'
        };
      default:
        return {
          icon: '⚠️',
          text: 'Disconnected',
          color: 'text-gray-400',
          bg: 'bg-gray-500'
        };
    }
  };

  const connectionDisplay = getConnectionDisplay();

  // Show connection error with retry
  if (connectionStatus === 'error' && retryCount >= 5) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold mb-2">Connection Failed</h2>
          <p className="mb-6">Unable to connect to the video call server. Please check your internet connection and try again.</p>
          <button 
            onClick={retryConnection}
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            🔄 Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // If in call, show video component
  if (activeCall) {
    const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.id : 'User';
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900">
        <button
          onClick={endCall}
          className="absolute top-6 right-6 z-50 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-3 rounded-full font-semibold shadow-2xl transition-all duration-300 transform hover:scale-105"
        >
          💔 End Call
        </button>
        <CustomVideoCall 
          roomId={activeCall.roomId}
          userName={userName}
          onCallEnd={endCall}
          otherUser={activeCall.otherUser}
          currentUser={user}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative z-10 px-6 py-12 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            💖 Find Your Perfect Match
          </h1>
          <p className="text-pink-200 text-lg">
            Connect with amazing people through video calls
          </p>
          
          {/* Connection Status */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className={`w-3 h-3 rounded-full ${connectionDisplay.bg} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`}></div>
            <span className={`text-sm font-medium ${connectionDisplay.color}`}>
              {connectionDisplay.icon} {connectionDisplay.text}
            </span>
            {connectionStatus !== 'connected' && retryCount < 5 && (
              <button
                onClick={retryConnection}
                className="ml-3 text-xs bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded-full transition-all"
              >
                🔄 Retry
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-12">
        {/* Incoming Call Modal */}
        {incomingCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl transform animate-bounce">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <span className="text-3xl">📞</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Incoming Call</h3>
                <p className="text-gray-600 mb-8">
                  <span className="font-semibold text-purple-600">{incomingCall.callerName}</span> wants to video chat with you
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={acceptCall}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-4 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    💚 Accept
                  </button>
                  <button
                    onClick={rejectCall}
                    className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white py-4 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    💔 Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Online Users Section */}
        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white border-opacity-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <span className="mr-3">👥</span>
              People Online
            </h2>
            <div className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
              connectionStatus === 'connected' ? 'bg-green-500 text-white' : 'bg-gray-500 text-gray-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-white animate-pulse' : 'bg-gray-300'
              }`}></div>
              {onlineUsers.length} Online
            </div>
          </div>

          {/* Show loading when connecting */}
          {connectionStatus === 'connecting' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
                <span className="text-2xl">⚡</span>
              </div>
              <p className="text-white text-lg font-semibold mb-2">Connecting to server...</p>
              <p className="text-pink-200">Finding people online...</p>
            </div>
          )}

          {/* Show users when connected */}
          {connectionStatus === 'connected' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {onlineUsers.map(userItem => (
                <div
                  key={userItem.id}
                  className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-6 border border-white border-opacity-30 hover:bg-opacity-30 transition-all duration-300 transform hover:scale-105"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {(userItem.first_name || userItem.id).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-lg">
                          {userItem.first_name || userItem.id}
                        </h3>
                        <p className="text-sm text-pink-200">
                          {userItem.isInCall ? (
                            <span className="flex items-center">
                              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                              In Call
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                              Available
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => callUser(userItem)}
                      disabled={userItem.isInCall}
                      className={`px-6 py-3 rounded-full font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                        userItem.isInCall
                          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg'
                      }`}
                    >
                      {userItem.isInCall ? '💤 Busy' : '📹 Video Call'}
                    </button>
                  </div>
                </div>
              ))}
              
              {onlineUsers.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">😴</span>
                  </div>
                  <p className="text-white text-lg font-semibold mb-2">No one else is online</p>
                  <p className="text-pink-200">Invite your friends to join!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}