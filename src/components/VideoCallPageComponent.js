'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import VideoCallComponent from '@/components/VideoCallComponent';

const SOCKET_URL = 'wss://socket.wanesni.com';
const BACKEND_URL = 'https://wanesni.com';

export default function VideoCallPageComponent() {
  const { user, apiCall } = useAuth();
  const router = useRouter();
  
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callType, setCallType] = useState('video');
  const [incomingCall, setIncomingCall] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false,
      timeout: 20000,
      forceNew: true,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to socket server');
      newSocket.emit('init', {
        userId: user.id,
        firstName: user.first_name,
      });
    });

    // Video call event listeners
    newSocket.on('incomingCall', (callData) => {
      console.log('📞 Incoming call received:', callData);
      setIncomingCall(callData);
    });

    newSocket.on('callEnded', (data) => {
      console.log('📴 Call ended:', data);
      setShowVideoCall(false);
      setIncomingCall(null);
      loadCallHistory();
    });

    newSocket.on('onlineUsers', (users) => {
      console.log('👥 Online users updated:', users);
      setOnlineUsers(users);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user, router]);

  // Load data
  useEffect(() => {
    if (user) {
      loadAllUsers();
      loadCallHistory();
    }
  }, [user]);

  // Load all users
  const loadAllUsers = async () => {
    try {
      const response = await apiCall(
        `${BACKEND_URL}/users?filter[id][_neq]=${user.id}&fields=id,first_name,last_name,email&limit=100`
      );

      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.data || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Load call history
  const loadCallHistory = async () => {
    try {
      const response = await apiCall(
        `${BACKEND_URL}/items/video_calls?filter[_or][0][caller_id][_eq]=${user.id}&filter[_or][1][callee_id][_eq]=${user.id}&sort=-start_time&limit=50`
      );

      if (response.ok) {
        const data = await response.json();
        setCallHistory(data.data || []);
      }
    } catch (error) {
      console.error('Error loading call history:', error);
    }
  };

  // Check if user is online
  const isUserOnline = (userId) => {
    return onlineUsers.some((u) => u.id === userId);
  };

  // Start video call
  const startVideoCall = (otherUser) => {
    setSelectedUser(otherUser);
    setCallType('video');
    setShowVideoCall(true);
  };

  // Start audio call
  const startAudioCall = (otherUser) => {
    setSelectedUser(otherUser);
    setCallType('audio');
    setShowVideoCall(true);
  };

  // Handle incoming call response
  const handleIncomingCallResponse = (accepted) => {
    if (!incomingCall) return;

    if (accepted) {
      // Find the caller user info
      const caller = allUsers.find(u => u.id === incomingCall.callerId);
      setSelectedUser(caller);
      setCallType(incomingCall.callType);
      setShowVideoCall(true);
    }

    setIncomingCall(null);
  };

  // End call handler
  const handleCallEnd = () => {
    setShowVideoCall(false);
    setSelectedUser(null);
    setIncomingCall(null);
    loadCallHistory();
  };

  // Format call duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get call type icon
  const getCallTypeIcon = (callType) => {
    if (callType === 'video') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Video Call Component */}
      {showVideoCall && (
        <VideoCallComponent
          socket={socket}
          callType={callType}
          onCallEnd={handleCallEnd}
          otherUser={selectedUser}
          initialCallData={incomingCall}
        />
      )}

      {/* Incoming Call Modal */}
      {incomingCall && !showVideoCall && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="mb-6">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-3xl text-white">
                  {incomingCall.callerName?.charAt(0) || '?'}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {incomingCall.callerName}
              </h3>
              <p className="text-gray-600">
                Incoming {incomingCall.callType} call...
              </p>
            </div>

            <div className="flex space-x-4 justify-center">
              <button
                onClick={() => handleIncomingCallResponse(false)}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l1.5 1.5M4.5 4.5l15 15" />
                </svg>
              </button>

              <button
                onClick={() => handleIncomingCallResponse(true)}
                className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110 animate-pulse"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/chat')}
                className="text-gray-600 hover:text-blue-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Video Calls</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                Call History
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.first_name?.charAt(0)}
                </div>
                <span className="text-gray-700 font-medium">{user?.first_name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Users List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Available Users</h2>
                <p className="text-gray-600 mt-1">Start a video or audio call with online users</p>
              </div>
              
              <div className="p-6">
                {allUsers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {allUsers.map((otherUser) => (
                      <div key={otherUser.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                                {otherUser.first_name?.charAt(0) || '?'}
                              </div>
                              {isUserOnline(otherUser.id) && (
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {otherUser.first_name} {otherUser.last_name}
                              </h3>
                              <p className="text-sm text-gray-600">{otherUser.email}</p>
                              <span className={`text-xs font-medium ${isUserOnline(otherUser.id) ? 'text-green-600' : 'text-gray-400'}`}>
                                {isUserOnline(otherUser.id) ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                          
                          {isUserOnline(otherUser.id) && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startAudioCall(otherUser)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Audio Call"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </button>
                              
                              <button
                                onClick={() => startVideoCall(otherUser)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Video Call"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No users available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Call History Sidebar */}
          {showHistory && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Call History</h3>
                </div>
                
                <div className="p-6 max-h-96 overflow-y-auto">
                  {callHistory.length > 0 ? (
                    <div className="space-y-3">
                      {callHistory.map((call) => {
                        const otherUser = allUsers.find(u => 
                          u.id === (call.caller_id === user.id ? call.callee_id : call.caller_id)
                        );
                        const isOutgoing = call.caller_id === user.id;
                        
                        return (
                          <div key={call.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {getCallTypeIcon(call.call_type)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {otherUser?.first_name || 'Unknown User'}
                                </p>
                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                  <span className={isOutgoing ? 'text-blue-600' : 'text-green-600'}>
                                    {isOutgoing ? '↗️ Outgoing' : '↙️ Incoming'}
                                  </span>
                                  <span>•</span>
                                  <span>{formatDuration(call.duration)}</span>
                                </div>
                                <p className="text-xs text-gray-400">
                                  {new Date(call.start_time).toLocaleString()}
                                </p>
                              </div>
                              
                              <div className="flex-shrink-0">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  call.call_status === 'ended' ? 'bg-green-100 text-green-800' :
                                  call.call_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {call.call_status}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">No call history</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}