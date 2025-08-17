'use client';

import { useState, useEffect } from 'react';
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

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('access_token') || '' }
    });

    setSocket(newSocket);

    // Initialize user
    newSocket.emit('init', {
      userId: user.id,
      firstName: user.first_name || user.id
    });

    // Listen for online users
    newSocket.on('onlineUsers', (usersList) => {
      setOnlineUsers(usersList.filter(u => u.id !== user.id));
    });

    // Listen for incoming calls
    newSocket.on('incomingCall', (data) => {
      console.log('📞 Incoming call:', data);
      setIncomingCall(data);
    });

    // Listen for call accepted
    newSocket.on('callAccepted', (data) => {
      console.log('✅ Call accepted:', data);
      setActiveCall({
        roomId: data.roomId || `room_${data.callId}`,
        callId: data.callId,
        isInitiator: true
      });
      setIncomingCall(null);
    });

    // Listen for call rejected
    newSocket.on('callRejected', (data) => {
      console.log('❌ Call rejected:', data);
      alert('Call was rejected');
      setIncomingCall(null);
    });

    // Listen for call ended
    newSocket.on('callEnded', (data) => {
      console.log('📴 Call ended:', data);
      setActiveCall(null);
      setIncomingCall(null);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Fetch users
  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        const response = await apiCall(`${BACKEND_URL}/users`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [user]);

  // Call user
  const callUser = (targetUser) => {
    if (!socket || !user) return;

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    socket.emit('callOffer', {
      callId,
      roomId,
      callerId: user.id,
      callerName: user.first_name || user.id,
      calleeId: targetUser.id,
      callType: 'video'
    });

    console.log(`📞 Calling ${targetUser.first_name}...`);
  };

  // Accept call
  const acceptCall = () => {
    if (!socket || !incomingCall) return;

    socket.emit('callResponse', {
      callId: incomingCall.callId,
      response: 'accepted',
      callerId: incomingCall.callerId
    });

    setActiveCall({
      roomId: incomingCall.roomId,
      callId: incomingCall.callId,
      isInitiator: false
    });
    setIncomingCall(null);
  };

  // Reject call
  const rejectCall = () => {
    if (!socket || !incomingCall) return;

    socket.emit('callResponse', {
      callId: incomingCall.callId,
      response: 'rejected',
      callerId: incomingCall.callerId
    });

    setIncomingCall(null);
  };

  // End call
  const endCall = () => {
    if (!socket || !activeCall) return;

    socket.emit('callEnded', {
      callId: activeCall.callId,
      reason: 'ended_by_user'
    });

    setActiveCall(null);
  };

  // If in call, show video component
  if (activeCall) {
    const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'User';
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900">
        {/* Beautiful end call button */}
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
  otherUser={activeCall.otherUser || activeCall.callerData}
  currentUser={user} // Add this line - pass your current user data
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
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-12">
        {/* Incoming Call Modal */}
        {incomingCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl transform animate-pulse">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
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
            <div className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
              {onlineUsers.length} Online
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
}