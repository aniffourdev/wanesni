'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';

const SOCKET_URL = 'wss://socket.wanesni.com';
const BACKEND_URL = 'https://wanesni.com';

// Custom Audio Player Component
const AudioPlayer = ({ src, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);

    const handleAudioEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleAudioEnd);

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleAudioEnd);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-2xl min-w-[200px] max-w-[280px] ${
      isOwn 
        ? 'bg-white bg-opacity-20 text-white' 
        : 'bg-gray-50 text-gray-800 border border-gray-200'
    }`}>
      <audio ref={audioRef} src={src} />
      
      {/* Play/Pause Button */}
      <button
        onClick={togglePlayPause}
        disabled={isLoading}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
          isOwn
            ? 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white'
            : 'bg-pink-500 hover:bg-pink-600 text-white shadow-md'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      {/* Waveform/Progress Bar */}
      <div className="flex-1">
        <div 
          className="relative h-8 cursor-pointer flex items-center"
          onClick={handleSeek}
        >
          {/* Background bars (simulated waveform) */}
          <div className="flex items-center space-x-0.5 w-full h-full">
            {[...Array(20)].map((_, i) => {
              const height = Math.random() * 16 + 8; // Random height between 8-24px
              const isActive = (i / 20) * 100 <= progress;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-200 ${
                    isOwn
                      ? isActive 
                        ? 'bg-white' 
                        : 'bg-white bg-opacity-30'
                      : isActive 
                        ? 'bg-pink-500' 
                        : 'bg-gray-300'
                  }`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        </div>
        
        {/* Time Display */}
        <div className={`text-xs mt-1 ${isOwn ? 'text-white text-opacity-80' : 'text-gray-500'}`}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
};

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [activeTab, setActiveTab] = useState('conversations');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // New states for multimedia
  const [showGifts, setShowGifts] = useState(false);
  const [gifts, setGifts] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const router = useRouter();

  // Initialize socket connection
  useEffect(() => {
    // Check for demo user or real user
    const demoUser = localStorage.getItem('demo_user');
    const realUser = localStorage.getItem('user');
    
    let currentUser;
    if (demoUser) {
      currentUser = JSON.parse(demoUser);
    } else if (realUser) {
      currentUser = JSON.parse(realUser);
    } else {
      router.push('/');
      return;
    }
    
    setUser(currentUser);

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false,
      timeout: 20000,
      forceNew: true,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to socket server');
      setConnectionStatus('Connected');
      newSocket.emit('init', {
        userId: currentUser.id,
        firstName: currentUser.first_name
      });
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionStatus('Connection Failed');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from socket server:', reason);
      setConnectionStatus('Disconnected');
    });

    newSocket.on('reconnect', () => {
      console.log('🔄 Reconnected to socket server');
      setConnectionStatus('Reconnected');
    });

    // Listen for online users
    newSocket.on('onlineUsers', (users) => {
      console.log('👥 Online users updated:', users);
      setOnlineUsers(users);
    });

    // Listen for new messages - FIXED
    newSocket.on('newMessage', (message) => {
      console.log('📨 New message received:', message);
      
      // Only add message if it's not from current user (avoid duplicates)
      if (message.sender?.id !== currentUser.id) {
        setMessages(prev => {
          // Check if message already exists by content and timestamp (more reliable than ID)
          const exists = prev.find(msg => 
            msg.content === message.content && 
            msg.user_created === message.sender?.id &&
            Math.abs(new Date(msg.date_created) - new Date(message.timestamp)) < 5000 // Within 5 seconds
          );
          
          if (!exists) {
            const newMsg = {
              id: message.id || `socket_${Date.now()}_${Math.random()}`,
              conversation_id: message.conversationId,
              content: message.content,
              message_type: message.message_type || 'text',
              media_url: message.media_url,
              gift_id: message.gift_id,
              user_created: message.sender?.id,
              date_created: message.timestamp || new Date().toISOString(),
              status: 'delivered',
              user_created: {
                first_name: message.sender?.first_name
              }
            };
            console.log('➕ Adding new message to UI:', newMsg);
            return [...prev, newMsg];
          }
          return prev;
        });
        
        // Update conversation last message
        setConversations(prev => {
          return prev.map(conv => 
            conv.id === message.conversationId 
              ? { 
                  ...conv, 
                  last_message: message.content || getMessagePreview(message),
                  last_message_time: message.timestamp || new Date().toISOString()
                }
              : conv
          );
        });
      }
    });

    // Listen for message notifications
    newSocket.on('messageNotification', (notification) => {
      console.log('🔔 New message notification:', notification);
      if (Notification.permission === 'granted') {
        new Notification(`Message from ${notification.senderName}`, {
          body: notification.content,
          icon: '/favicon.ico'
        });
      }

      // Create conversation if it doesn't exist
      setConversations(prev => {
        const existingConv = prev.find(conv => conv.id === notification.conversationId);
        if (!existingConv) {
          const newConv = {
            id: notification.conversationId,
            user1_id: currentUser.id,
            user2_id: notification.senderId,
            last_message: notification.content,
            last_message_time: new Date().toISOString(),
            other_user_name: notification.senderName
          };
          return [newConv, ...prev];
        }
        return prev;
      });
    });

    // Listen for typing indicators
    newSocket.on('userTyping', (data) => {
      console.log('⌨️ User typing:', data);
      setTypingUsers(prev => {
        if (data.isTyping) {
          return [...prev.filter(u => u.userId !== data.userId), data];
        } else {
          return prev.filter(u => u.userId !== data.userId);
        }
      });
    });

    // Listen for message status updates
    newSocket.on('messageStatusUpdate', (data) => {
      console.log('📍 Message status update:', data);
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, status: data.status }
          : msg
      ));
    });

    newSocket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    setSocket(newSocket);
    setLoading(false);

    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    return () => {
      newSocket.close();
    };
  }, [router]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations, users and gifts
  useEffect(() => {
    if (user) {
      loadConversations();
      loadAllUsers();
      loadGifts();
      checkAudioSupport();
    }
  }, [user]);

  // Check if audio recording is supported
  const checkAudioSupport = () => {
    const isSupported = !!(
      navigator.mediaDevices && 
      navigator.mediaDevices.getUserMedia && 
      window.MediaRecorder &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    );
    setAudioSupported(isSupported);
    console.log('🎤 Audio recording supported:', isSupported);
  };

  // Helper function to get message preview for different types
  const getMessagePreview = (message) => {
    switch (message.message_type) {
      case 'image': return '📷 Image';
      case 'voice': return '🎵 Voice message';
      case 'gift': return '🎁 Gift';
      default: return message.content || 'New message';
    }
  };

  // Helper function to get other user name from conversation
  const getOtherUserName = (conversation) => {
    if (conversation.other_user_name) {
      return conversation.other_user_name;
    }
    
    // Try to find the other user in allUsers
    const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;
    const otherUser = allUsers.find(u => u.id === otherUserId);
    
    if (otherUser) {
      return `${otherUser.first_name} ${otherUser.last_name || ''}`.trim();
    }
    
    // Fallback to a shortened conversation ID
    return `User ${conversation.id.substring(0, 8)}...`;
  };

  const loadGifts = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${BACKEND_URL}/items/gifts?fields=*`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setGifts(data.data || []);
      }
    } catch (error) {
      console.error('Error loading gifts:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${BACKEND_URL}/items/conversations?filter[_or][0][user1_id][_eq]=${user.id}&filter[_or][1][user2_id][_eq]=${user.id}&sort=-last_message_time`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data.data || []);
      } else {
        console.error('Failed to load conversations:', response.status);
        if (localStorage.getItem('demo_user')) {
          createDemoConversations();
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      if (localStorage.getItem('demo_user')) {
        createDemoConversations();
      }
    }
  };

  const loadAllUsers = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${BACKEND_URL}/users?filter[id][_neq]=${user.id}&fields=id,first_name,last_name,email&limit=100`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.data || []);
      } else {
        console.error('Failed to load users:', response.status);
        if (localStorage.getItem('demo_user')) {
          createDemoUsers();
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
      if (localStorage.getItem('demo_user')) {
        createDemoUsers();
      }
    }
  };

  const createDemoUsers = () => {
    const demoUsers = [
      { id: '1', first_name: 'Alice', last_name: 'Demo', email: 'alice@demo.com' },
      { id: '2', first_name: 'Bob', last_name: 'Demo', email: 'bob@demo.com' },
      { id: '3', first_name: 'Charlie', last_name: 'Demo', email: 'charlie@demo.com' },
      { id: '4', first_name: 'Diana', last_name: 'Demo', email: 'diana@demo.com' },
    ].filter(u => u.id !== user.id);
    
    setAllUsers(demoUsers);
  };

  const createDemoConversations = () => {
    const demoConversations = [
      {
        id: 'demo-1',
        user1_id: user.id,
        user2_id: user.id === '1' ? '2' : '1',
        last_message: 'Hello there!',
        last_message_time: new Date().toISOString(),
        other_user_name: user.id === '1' ? 'Bob Demo' : 'Alice Demo'
      }
    ];
    setConversations(demoConversations);
  };

  const loadMessages = async (conversationId) => {
    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${BACKEND_URL}/items/messages?filter[conversation_id][_eq]=${conversationId}&sort=date_created&fields=*,user_created.first_name,gift_id.name_gift,gift_id.gift_image,gift_id.coins_gift`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || []);
        markMessagesAsRead(conversationId);
      } else {
        console.error('Failed to load messages:', response.status);
        if (conversationId.startsWith('demo-') || conversationId.startsWith('temp-')) {
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      if (conversationId.startsWith('demo-') || conversationId.startsWith('temp-')) {
        setMessages([]);
      }
    }
  };

  const markMessagesAsRead = async (conversationId) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      await fetch(`${BACKEND_URL}/items/messages?filter[conversation_id][_eq]=${conversationId}&filter[receiver_id][_eq]=${user.id}&filter[status][_neq]=read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'read'
        })
      });

      if (socket) {
        socket.emit('updateMessageStatus', {
          conversationId,
          status: 'read'
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const selectConversation = (conversation) => {
    if (activeConversation && socket) {
      socket.emit('leaveConversation', {
        conversationId: activeConversation.id,
        userId: user.id
      });
    }

    setActiveConversation(conversation);
    loadMessages(conversation.id);
    setSidebarOpen(false); // Close sidebar on mobile

    if (socket) {
      socket.emit('joinConversation', {
        conversationId: conversation.id,
        userId: user.id
      });
    }
  };

  const startConversationWithUser = (selectedUser) => {
    const existingConv = conversations.find(conv => 
      (conv.user1_id === user.id && conv.user2_id === selectedUser.id) ||
      (conv.user1_id === selectedUser.id && conv.user2_id === user.id)
    );
    
    if (existingConv) {
      selectConversation(existingConv);
      return;
    }

    const tempConversation = {
      id: `temp-${user.id}-${selectedUser.id}`,
      user1_id: user.id,
      user2_id: selectedUser.id,
      last_message: '',
      last_message_time: new Date().toISOString(),
      other_user_name: `${selectedUser.first_name} ${selectedUser.last_name || ''}`.trim(),
      isTemporary: true
    };

    setActiveConversation(tempConversation);
    setMessages([]);
    setActiveTab('conversations');
    setSidebarOpen(false); // Close sidebar on mobile

    if (socket) {
      socket.emit('joinConversation', {
        conversationId: tempConversation.id,
        userId: user.id
      });
    }
  };

  // Upload file to Directus
  const uploadFile = async (file, folder = '7eb75910-553f-45a9-9758-70fab9a0fa7e') => {
    const token = localStorage.getItem('access_token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await fetch(`${BACKEND_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      return data.data.id;
    } else {
      throw new Error('Failed to upload file');
    }
  };

  // Send message (text, image, voice, or gift)
  const sendMessage = async (messageType = 'text', content = '', mediaUrl = null, giftId = null) => {
    if (!activeConversation || !socket) return;
    if (messageType === 'text' && !content.trim()) return;

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const receiverId = activeConversation.user1_id === user.id ? activeConversation.user2_id : activeConversation.user1_id;
    let conversationId = activeConversation.id;

    // If this is a temporary conversation, create it first
    if (activeConversation.isTemporary) {
      try {
        const realConversation = await createRealConversation(activeConversation);
        if (realConversation) {
          conversationId = realConversation.id;
          setActiveConversation(realConversation);
          setConversations(prev => [realConversation, ...prev]);
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        if (localStorage.getItem('demo_user')) {
          conversationId = activeConversation.id;
        } else {
          return;
        }
      }
    }

    const messageData = {
      conversation_id: conversationId,
      receiver_id: receiverId,
      content: content,
      message_type: messageType,
      status: 'sent'
    };

    if (mediaUrl) messageData.media_url = mediaUrl;
    if (giftId) messageData.gift_id = giftId;

    // Add temporary message to UI immediately
    const tempMessage = {
      id: tempId,
      ...messageData,
      user_created: user.id,
      date_created: new Date().toISOString(),
      sending: true
    };
    
    console.log('➕ Adding sent message to UI:', tempMessage);
    setMessages(prev => [...prev, tempMessage]);
    
    if (messageType === 'text') {
      setNewMessage('');
    }
    stopTyping();

    try {
      const token = localStorage.getItem('access_token');

      // Save to Directus (skip for demo conversations)
      if (!conversationId.startsWith('demo-') && !conversationId.startsWith('temp-')) {
        const headers = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${BACKEND_URL}/items/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(messageData)
        });

        if (response.ok) {
          const savedMessage = await response.json();

          // Update the temporary message with real data
          setMessages(prev => prev.map(msg =>
            msg.id === tempId
              ? { ...savedMessage.data, sending: false }
              : msg
          ));

          // Send via socket with real message data
          socket.emit('sendMessage', {
            ...savedMessage.data,
            conversationId: conversationId,
            receiverId: receiverId
          });

          updateConversationLastMessage(conversationId, content || getMessagePreview(messageData));
          console.log('✅ Message saved to Directus and sent via socket');
        } else {
          throw new Error('Failed to save message');
        }
      } else {
        // For demo conversations
        const demoMessage = {
          ...tempMessage,
          id: tempId,
          sending: false
        };

        setMessages(prev => prev.map(msg =>
          msg.id === tempId ? demoMessage : msg
        ));

        // Send via socket for demo
        socket.emit('sendMessage', {
          id: tempId,
          conversationId: conversationId,
          receiverId: receiverId,
          content: messageData.content,
          message_type: messageData.message_type,
          media_url: mediaUrl,
          gift_id: giftId
        });

        console.log('✅ Demo message sent via socket');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === tempId
          ? { ...msg, sending: false, failed: true, status: 'failed' }
          : msg
      ));
    }
  };

  const handleTextMessage = (e) => {
    e.preventDefault();
    sendMessage('text', newMessage);
  };

  // Handle image upload and send
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const mediaId = await uploadFile(file);
      await sendMessage('image', '', mediaId);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle gift selection
  const handleGiftSelect = async (gift) => {
    setShowGifts(false);
    await sendMessage('gift', `🎁 Sent a gift: ${gift.name_gift}`, null, gift.id);
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      // Check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.');
        return;
      }

      // Check if we're on HTTPS or localhost
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        alert('Audio recording requires HTTPS. Please use a secure connection.');
        return;
      }

      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        alert('MediaRecorder is not supported in your browser.');
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      console.log('✅ Microphone access granted, starting recording...');
      
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        console.log('📊 Audio data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing audio...');
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: mimeType });
        
        if (audioBlob.size === 0) {
          alert('Recording failed - no audio data captured');
          return;
        }

        const fileExtension = mimeType.includes('webm') ? 'webm' : 'mp4';
        const audioFile = new File([audioBlob], `voice-message.${fileExtension}`, { type: mimeType });
        
        console.log('📁 Audio file created:', audioFile.size, 'bytes');
        
        setUploadingMedia(true);
        try {
          const mediaId = await uploadFile(audioFile);
          await sendMessage('voice', '🎵 Voice message', mediaId);
          console.log('✅ Voice message sent successfully');
        } catch (error) {
          console.error('❌ Error uploading voice message:', error);
          alert('Failed to send voice message: ' + error.message);
        } finally {
          setUploadingMedia(false);
        }
        
        // Stop all tracks and clean up
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🔇 Audio track stopped');
        });
      };

      recorder.onerror = (event) => {
        console.error('❌ Recording error:', event.error);
        alert('Recording error: ' + event.error);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      console.log('🔴 Recording started');

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      
      // Provide specific error messages
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotSupportedError') {
        alert('Your browser does not support audio recording.');
      } else if (error.name === 'NotReadableError') {
        alert('Microphone is already in use by another application.');
      } else {
        alert('Failed to start recording: ' + error.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      console.log('⏹️ Stopping recording...');
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const createRealConversation = async (tempConversation) => {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token || localStorage.getItem('demo_user')) {
        return {
          ...tempConversation,
          id: `demo-${Date.now()}`,
          isTemporary: false
        };
      }

      const response = await fetch(`${BACKEND_URL}/items/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user1_id: tempConversation.user1_id,
          user2_id: tempConversation.user2_id,
          last_message: '',
          last_message_time: new Date().toISOString()
        })
      });

      if (response.ok) {
        const newConversation = await response.json();
        return {
          ...newConversation.data,
          other_user_name: tempConversation.other_user_name,
          isTemporary: false
        };
      } else {
        throw new Error('Failed to create conversation');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const updateConversationLastMessage = async (conversationId, messageContent) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token || conversationId.startsWith('demo-') || conversationId.startsWith('temp-')) return;

      await fetch(`${BACKEND_URL}/items/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          last_message: messageContent,
          last_message_time: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!isTyping && activeConversation && socket) {
      setIsTyping(true);
      socket.emit('typing', {
        conversationId: activeConversation.id,
        isTyping: true
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const stopTyping = () => {
    if (isTyping && activeConversation && socket) {
      setIsTyping(false);
      socket.emit('typing', {
        conversationId: activeConversation.id,
        isTyping: false
      });
    }
  };

  const logout = () => {
    if (socket) {
      socket.disconnect();
    }
    localStorage.removeItem('demo_user');
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    router.push('/');
  };

  const isUserOnline = (userId) => {
    return onlineUsers.some(u => u.id === userId);
  };

  // Render message content based on type
  const renderMessageContent = (message) => {
    const isOwn = message.user_created === user.id;
    
    switch (message.message_type) {
      case 'image':
        return (
          <div className="max-w-sm">
            <img 
              src={`${BACKEND_URL}/assets/${message.media_url}?width=300&height=300&fit=cover`}
              alt="Shared image"
              className="rounded-xl max-w-full h-auto cursor-pointer hover:opacity-90 transition-all duration-300 shadow-md"
              onClick={() => window.open(`${BACKEND_URL}/assets/${message.media_url}`, '_blank')}
            />
          </div>
        );
      
      case 'voice':
        return (
          <AudioPlayer 
            src={`${BACKEND_URL}/assets/${message.media_url}`}
            isOwn={isOwn}
          />
        );
      
      case 'gift':
        return (
          <div className="bg-gradient-to-r from-pink-400 via-purple-500 to-pink-500 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                {message.gift_id?.gift_image ? (
                  <img 
                    src={`${BACKEND_URL}/assets/${message.gift_id.gift_image}`}
                    alt={message.gift_id.name_gift}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <span className="text-2xl">🎁</span>
                )}
              </div>
              <div>
                <div className="font-semibold">{message.gift_id?.name_gift || 'Gift'}</div>
                <div className="text-sm opacity-90 flex items-center">
                  <span className="mr-1">💎</span>
                  {message.gift_id?.coins_gift || 0} coins
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return <div className="break-words">{message.content}</div>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-pink-200 border-t-pink-500 mx-auto"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-purple-200 border-b-purple-500 mx-auto animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="mt-6 text-xl font-semibold text-gray-700">Loading chat...</p>
          <p className="text-sm text-gray-500 mt-2">Connecting to your conversations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-50 w-full sm:w-96 lg:w-1/3 xl:w-1/4 bg-white shadow-2xl lg:shadow-xl flex flex-col h-full`}>
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">ChatApp</h2>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${connectionStatus === 'Connected' ? 'bg-green-400' : 'bg-red-400'} shadow-lg`}></div>
                  <span className="text-sm opacity-90">{connectionStatus}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={logout}
                className="text-sm bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded-lg transition-all duration-200 backdrop-blur-sm"
              >
                Logout
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 bg-gradient-to-r from-pink-100 to-purple-100 border-b border-pink-200">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                {user?.first_name?.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
            </div>
            <div>
              <p className="font-semibold text-gray-800">{user?.first_name}</p>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 py-4 px-4 text-sm font-semibold border-b-2 transition-all duration-200 ${
              activeTab === 'conversations'
                ? 'border-pink-500 text-pink-600 bg-gradient-to-t from-pink-50 to-transparent'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <span>Chats</span>
              <span className="bg-pink-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                {conversations.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-4 px-4 text-sm font-semibold border-b-2 transition-all duration-200 ${
              activeTab === 'users'
                ? 'border-pink-500 text-pink-600 bg-gradient-to-t from-pink-50 to-transparent'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <span>Users</span>
              <span className="bg-purple-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                {allUsers.length}
              </span>
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'conversations' ? (
            <>
              {conversations.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {conversations.map(conversation => (
                    <div
                      key={conversation.id}
                      onClick={() => selectConversation(conversation)}
                      className={`p-4 cursor-pointer hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 transition-all duration-200 ${
                        activeConversation?.id === conversation.id 
                          ? 'bg-gradient-to-r from-pink-100 to-purple-100 border-r-4 border-pink-500' 
                          : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                            {getOtherUserName(conversation)?.charAt(0) || '?'}
                          </div>
                          {isUserOnline(conversation.user2_id === user.id ? conversation.user1_id : conversation.user2_id) && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-gray-900 truncate">
                              {getOtherUserName(conversation)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(conversation.last_message_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 truncate mt-1">
                            {conversation.last_message || 'No messages yet'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">No conversations yet</p>
                  <p className="text-sm text-gray-500 mt-1">Start chatting with users to see your conversations here!</p>
                </div>
              )}
            </>
          ) : (
            <>
              {allUsers.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {allUsers.map(userItem => (
                    <div
                      key={userItem.id}
                      onClick={() => startConversationWithUser(userItem)}
                      className="p-4 cursor-pointer hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                              {userItem.first_name?.charAt(0) || '?'}
                            </div>
                            {isUserOnline(userItem.id) && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                              {userItem.first_name} {userItem.last_name}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              {userItem.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {isUserOnline(userItem.id) ? (
                            <span className="text-xs text-green-600 font-semibold bg-green-100 px-2 py-1 rounded-full">Online</span>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">Offline</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">Loading users...</p>
                  <p className="text-sm text-gray-500 mt-1">Please wait while we fetch available users</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 sm:p-6 bg-white border-b border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden text-gray-600 hover:text-pink-600 hover:bg-pink-50 p-2 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold shadow-lg">
                      {getOtherUserName(activeConversation)?.charAt(0) || '?'}
                    </div>
                    {isUserOnline(activeConversation.user1_id === user.id ? activeConversation.user2_id : activeConversation.user1_id) && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      {getOtherUserName(activeConversation)}
                    </h3>
                    {activeConversation.isTemporary ? (
                      <div className="text-sm text-pink-600 font-medium">New conversation • Send a message to start</div>
                    ) : isUserOnline(activeConversation.user1_id === user.id ? activeConversation.user2_id : activeConversation.user1_id) ? (
                      <div className="text-sm text-green-600 font-medium">Online</div>
                    ) : (
                      <div className="text-sm text-gray-500">Last seen recently</div>
                    )}
                    {typingUsers.length > 0 && (
                      <div className="text-sm text-pink-600 font-medium flex items-center space-x-1">
                        <div className="flex space-x-1">
                          <div className="w-1 h-1 bg-pink-500 rounded-full animate-bounce"></div>
                          <div className="w-1 h-1 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-1 h-1 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span>{typingUsers.map(u => u.firstName).join(', ')} typing...</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {messages.length} messages
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.user_created === user.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl relative ${
                      message.user_created === user.id
                        ? 'order-1'
                        : 'order-2'
                    }`}
                  >
                    {/* Message bubble */}
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-sm relative ${
                        message.user_created === user.id
                          ? message.failed 
                            ? 'bg-red-500 text-white'
                            : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                          : 'bg-white text-gray-800 border border-gray-200 shadow-md'
                      } ${
                        message.user_created === user.id 
                          ? 'rounded-br-md ml-auto'
                          : 'rounded-bl-md mr-auto'
                      }`}
                    >
                      {/* Sender name for received messages */}
                      {message.user_created !== user.id && message.user_created?.first_name && (
                        <div className="text-xs text-pink-600 mb-2 font-semibold">
                          {message.user_created.first_name}
                        </div>
                      )}
                      
                      {/* Message Content */}
                      {renderMessageContent(message)}
                      
                      <div className={`text-xs mt-2 flex items-center justify-between ${
                        message.user_created === user.id 
                          ? message.failed 
                            ? 'text-red-200' 
                            : 'text-pink-100'
                          : 'text-gray-500'
                      }`}>
                        <span>
                          {new Date(message.date_created).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        
                        {message.user_created === user.id && (
                          <span className="ml-2 flex items-center">
                            {message.sending && (
                              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {message.failed && (
                              <svg className="h-3 w-3 text-red-300" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                            {!message.sending && !message.failed && (
                              <>
                                {message.status === 'sent' && '✓'}
                                {message.status === 'delivered' && '✓✓'}
                                {message.status === 'read' && <span className="text-pink-300">✓✓</span>}
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <svg className="w-10 h-10 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">No messages yet</p>
                  <p className="text-gray-500">Send a message to start your conversation!</p>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input with Multimedia Options */}
            <div className="p-4 sm:p-6 bg-white border-t border-gray-200">
              <form onSubmit={handleTextMessage} className="flex items-end space-x-3">
                {/* Media Buttons */}
                <div className="flex space-x-2">
                  {/* Image Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia || connectionStatus !== 'Connected'}
                    className="p-3 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm border border-gray-200"
                    title="Send Image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>

                  {/* Voice Record Button */}
                  {audioSupported ? (
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={uploadingMedia || connectionStatus !== 'Connected'}
                      className={`p-3 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm border ${
                        isRecording 
                          ? 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' 
                          : 'text-gray-500 hover:text-pink-600 hover:bg-pink-50 border-gray-200'
                      }`}
                      title={isRecording ? "Stop Recording" : "Record Voice Message"}
                    >
                      {isRecording ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a2 2 0 114 0v4a2 2 0 11-4 0V7z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div 
                      className="p-3 text-gray-300 cursor-not-allowed rounded-xl border border-gray-200 shadow-sm"
                      title="Voice recording not supported in this browser or requires HTTPS"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
                      </svg>
                    </div>
                  )}

                  {/* Gift Button */}
                  <button
                    type="button"
                    onClick={() => setShowGifts(true)}
                    disabled={uploadingMedia || connectionStatus !== 'Connected'}
                    className="p-3 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm border border-gray-200"
                    title="Send Gift"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </button>
                </div>

                {/* Text Input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleTyping}
                    onBlur={stopTyping}
                    placeholder={uploadingMedia ? "Uploading..." : isRecording ? "Recording..." : "Type your message..."}
                    className="w-full border border-gray-300 rounded-2xl px-6 py-3 pr-16 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 shadow-sm transition-all duration-200 bg-gray-50 focus:bg-white"
                    disabled={!socket || connectionStatus !== 'Connected' || uploadingMedia || isRecording}
                  />
                  
                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || !socket || connectionStatus !== 'Connected' || uploadingMedia || isRecording}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center justify-center shadow-lg disabled:shadow-none"
                  >
                    {uploadingMedia ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>

              {connectionStatus !== 'Connected' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Cannot send messages: {connectionStatus}
                  </p>
                </div>
              )}

              {isRecording && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center space-x-3 text-red-600">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Recording voice message... Click the microphone button to stop</span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="w-32 h-32 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
                <svg className="w-16 h-16 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                Welcome to ChatApp
              </h3>
              <p className="text-gray-600 mb-8 text-lg">
                Select a conversation to start chatting, or create a new one with online users.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-4 rounded-xl shadow-md border border-pink-100">
                  <div className="text-2xl mb-2">💬</div>
                  <div className="font-semibold text-gray-800">Real-time messaging</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border border-purple-100">
                  <div className="text-2xl mb-2">👥</div>
                  <div className="font-semibold text-gray-800">Online presence</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border border-pink-100">
                  <div className="text-2xl mb-2">📷</div>
                  <div className="font-semibold text-gray-800">Image sharing</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border border-purple-100">
                  <div className="text-2xl mb-2">🎁</div>
                  <div className="font-semibold text-gray-800">Gift sending</div>
                </div>
              </div>
              
              <button
                onClick={() => setSidebarOpen(true)}
                className="mt-8 lg:hidden bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200"
              >
                Open Conversations
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Gift Selection Modal */}
      {showGifts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Select a Gift</h3>
              <button
                onClick={() => setShowGifts(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {gifts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {gifts.map(gift => (
                  <div
                    key={gift.id}
                    onClick={() => handleGiftSelect(gift)}
                    className="border border-gray-200 rounded-xl p-6 cursor-pointer hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 hover:border-pink-300 transition-all duration-200 text-center group shadow-sm hover:shadow-md"
                  >
                    <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-pink-400 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
                      {gift.gift_image ? (
                        <img 
                          src={`${BACKEND_URL}/assets/${gift.gift_image}`}
                          alt={gift.name_gift}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <span className="text-2xl text-white">🎁</span>
                      )}
                    </div>
                    <div className="font-semibold text-gray-800 mb-1">{gift.name_gift}</div>
                    <div className="text-sm text-purple-600 font-medium flex items-center justify-center">
                      <span className="mr-1">💎</span>
                      {gift.coins_gift} coins
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">No gifts available</p>
                <p className="text-sm text-gray-500 mt-1">Check back later for amazing gifts!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}