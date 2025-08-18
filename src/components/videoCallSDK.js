'use client';

import { useRef, useEffect, useState } from 'react';

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

export default function CustomVideoCall({ roomId, userName, onCallEnd, otherUser, currentUser }) {
  const zegoContainerRef = useRef(null);
  const mainVideoContainerRef = useRef(null);
  const pipVideoContainerRef = useRef(null);
  const zpRef = useRef(null);
  const cleanupRef = useRef(false);
  const initializingRef = useRef(false);
  const videoCheckTimeoutRef = useRef(null);
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [hasVideos, setHasVideos] = useState(false);

  // Timer for call duration
  useEffect(() => {
    if (isCallActive) {
      const timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isCallActive]);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let mounted = true;
    cleanupRef.current = false;
    
    const initializeCall = async () => {
      if (!zegoContainerRef.current || !roomId || !userName || !mounted || initializingRef.current || zpRef.current) {
        return;
      }

      initializingRef.current = true;

      try {
        // Check if we're on HTTPS or localhost
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
        if (!isSecure) {
          setConnectionError('Video calls require HTTPS connection. Please use https://wanesni.com instead.');
          return;
        }

        const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');
        
        console.log('🎥 Starting video call:', { roomId, userName });

        const userID = randomID(8);
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          APP_ID,
          SERVER_SECRET,
          roomId,
          userID,
          userName
        );

        if (!mounted || cleanupRef.current || zpRef.current) {
          initializingRef.current = false;
          return;
        }

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        const handleUserJoin = (users) => {
          console.log('✅ Users joined:', users);
          setIsCallActive(true);
          if (users && users.length > 1) {
            setRemoteUserJoined(true);
            // Start checking for videos safely
            checkForVideos();
          }
        };

        const handleCallEnd = () => {
          console.log('📴 Call ended');
          if (!cleanupRef.current && onCallEnd) {
            cleanupRef.current = true;
            onCallEnd();
          }
        };

        const handleError = (error) => {
          console.error('❌ ZegoCloud error:', error);
          setConnectionError(`Call error: ${error.message || 'Connection failed'}`);
        };

        // Initialize with hidden ZegoCloud UI
        await zp.joinRoom({
          container: zegoContainerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          showPreJoinView: false,
          showLeavingView: false,
          showRoomTimer: false,
          showUserList: false,
          showTextChat: false,
          showScreenSharingButton: false,
          maxUsers: 2,
          layout: "Auto",
          showLayoutButton: false,
          showPinButton: false,
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: true,
          showMyCameraToggleButton: false, // Hide ZegoCloud's buttons
          showMyMicrophoneToggleButton: false, // Hide ZegoCloud's buttons
          showAudioVideoSettingsButton: false,
          onJoinRoom: handleUserJoin,
          onLeaveRoom: handleCallEnd,
          onUserJoin: handleUserJoin,
          onUserLeave: (users) => {
            console.log('👋 Users left:', users);
            if (users && users.length <= 1) {
              setRemoteUserJoined(false);
              setHasVideos(false);
              // Clear videos when user leaves
              clearVideoContainers();
            }
          },
          onReturnToHomeScreenClicked: handleCallEnd,
          onError: handleError,
          // Optimized config
          videoConfig: {
            quality: 'medium',
          },
          audioConfig: {
            quality: 'high',
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        setIsCallActive(true);
        // Start checking for videos immediately
        checkForVideos();
        
        console.log('✅ Video call initialized');
        initializingRef.current = false;

      } catch (error) {
        console.error('❌ Error initializing video call:', error);
        setConnectionError(`Failed to start call: ${error.message}`);
        initializingRef.current = false;
      }
    };

    // SAFE video detection - no complex DOM manipulation
    const checkForVideos = () => {
      if (cleanupRef.current || !mounted) return;

      try {
        // Clear any existing timeout
        if (videoCheckTimeoutRef.current) {
          clearTimeout(videoCheckTimeoutRef.current);
        }

        const findAndSetupVideos = () => {
          if (cleanupRef.current || !mounted) return;

          // Find video elements more safely
          const videos = Array.from(document.querySelectorAll('video')).filter(video => {
            try {
              return video.srcObject && 
                     video.srcObject.getVideoTracks && 
                     video.srcObject.getVideoTracks().length > 0 &&
                     video.readyState >= 2; // HAVE_CURRENT_DATA
            } catch (e) {
              return false;
            }
          });

          console.log(`📹 Found ${videos.length} ready videos`);

          if (videos.length === 0) {
            // Retry after a short delay
            videoCheckTimeoutRef.current = setTimeout(findAndSetupVideos, 1000);
            return;
          }

          // Setup videos safely
          setupCustomVideoLayout(videos);
        };

        // Start checking
        findAndSetupVideos();

      } catch (error) {
        console.error('❌ Error in checkForVideos:', error);
      }
    };

    // SAFE video layout setup
    const setupCustomVideoLayout = (videos) => {
      try {
        if (cleanupRef.current || !mounted) return;

        // Clear containers safely
        clearVideoContainers();

        let localVideo = null;
        let remoteVideo = null;

        // Simple detection: muted = local, unmuted = remote
        videos.forEach(video => {
          try {
            if (video.muted && !localVideo) {
              localVideo = video;
            } else if (!video.muted && !remoteVideo) {
              remoteVideo = video;
            }
          } catch (e) {
            console.log('Video check error:', e);
          }
        });

        // If detection failed, use first video as local
        if (!localVideo && videos.length > 0) {
          localVideo = videos[0];
        }
        if (!remoteVideo && videos.length > 1) {
          remoteVideo = videos[1];
        }

        console.log('📺 Video setup:', { 
          local: !!localVideo, 
          remote: !!remoteVideo, 
          remoteUserJoined 
        });

        // Setup display based on user presence
        if (remoteUserJoined && remoteVideo && localVideo) {
          // Both users: remote full screen, local PiP
          createVideoDisplay(remoteVideo, mainVideoContainerRef.current, {
            mirror: false,
            muted: false,
            label: 'remote'
          });
          
          createVideoDisplay(localVideo, pipVideoContainerRef.current, {
            mirror: true,
            muted: true,
            label: 'local-pip'
          });

        } else if (localVideo) {
          // Only local user: show in main
          createVideoDisplay(localVideo, mainVideoContainerRef.current, {
            mirror: true,
            muted: true,
            label: 'local-main'
          });

          // Also show in PiP for consistency
          createVideoDisplay(localVideo, pipVideoContainerRef.current, {
            mirror: true,
            muted: true,
            label: 'local-pip-copy'
          });
        }

        setHasVideos(true);

      } catch (error) {
        console.error('❌ Error in setupCustomVideoLayout:', error);
      }
    };

    // SAFE video element creation
    const createVideoDisplay = (sourceVideo, container, options = {}) => {
      try {
        if (!sourceVideo || !container || cleanupRef.current) return;

        // Create new video element instead of cloning
        const video = document.createElement('video');
        video.srcObject = sourceVideo.srcObject;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = options.muted !== false;
        
        // Styling
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.backgroundColor = '#000';
        video.style.transform = options.mirror ? 'scaleX(-1)' : 'none';
        
        // Mobile attributes
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('playsinline', 'true');
        
        // Add to container
        container.appendChild(video);
        
        // Play with error handling
        video.play().catch(e => {
          console.log(`Video play error for ${options.label}:`, e.message);
        });

        console.log(`✅ Created ${options.label} video display`);

      } catch (error) {
        console.error(`❌ Error creating video display:`, error);
      }
    };

    // SAFE container clearing
    const clearVideoContainers = () => {
      try {
        if (mainVideoContainerRef.current) {
          mainVideoContainerRef.current.innerHTML = '';
        }
        if (pipVideoContainerRef.current) {
          pipVideoContainerRef.current.innerHTML = '';
        }
      } catch (error) {
        console.error('❌ Error clearing containers:', error);
      }
    };

    initializeCall();

    return () => {
      mounted = false;
      cleanupRef.current = true;
      initializingRef.current = false;
      
      if (videoCheckTimeoutRef.current) {
        clearTimeout(videoCheckTimeoutRef.current);
        videoCheckTimeoutRef.current = null;
      }
      
      if (zpRef.current) {
        try {
          zpRef.current.destroy();
          zpRef.current = null;
        } catch (error) {
          console.log('Cleanup error:', error);
        }
      }
    };
  }, [roomId, userName]);

  // Mute toggle
  const toggleMute = async () => {
    if (!zpRef.current || cleanupRef.current) return;

    try {
      await zpRef.current.muteMicrophone(!isMuted);
      setIsMuted(!isMuted);
      console.log(`🎤 Microphone ${!isMuted ? 'muted' : 'unmuted'}`);
    } catch (error) {
      console.error('❌ Error toggling microphone:', error);
    }
  };

  // Camera toggle
  const toggleVideo = async () => {
    if (!zpRef.current || cleanupRef.current) return;

    try {
      await zpRef.current.muteVideoStream(!isVideoOn);
      setIsVideoOn(!isVideoOn);
      console.log(`📹 Camera ${!isVideoOn ? 'disabled' : 'enabled'}`);
    } catch (error) {
      console.error('❌ Error toggling camera:', error);
    }
  };

  const endCall = () => {
    if (cleanupRef.current) return;
    cleanupRef.current = true;
    
    console.log('📴 Ending call...');
    
    setIsCallActive(false);
    setRemoteUserJoined(false);
    setHasVideos(false);
    
    if (videoCheckTimeoutRef.current) {
      clearTimeout(videoCheckTimeoutRef.current);
      videoCheckTimeoutRef.current = null;
    }
    
    if (zpRef.current) {
      try {
        zpRef.current.destroy();
        zpRef.current = null;
      } catch (error) {
        console.log('End call cleanup error:', error);
      }
    }
    
    if (onCallEnd) {
      onCallEnd();
    }
  };

  // Show error screen if there's a connection error
  if (connectionError) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ marginBottom: '20px' }}>Connection Error</h2>
          <p style={{ marginBottom: '30px', maxWidth: '400px' }}>{connectionError}</p>
          <button
            onClick={endCall}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              borderRadius: '25px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            End Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden'
    }}>
      {/* ZegoCloud Container - Hidden but functional */}
      <div 
        ref={zegoContainerRef}
        style={{ 
          position: 'absolute',
          top: -10000,
          left: -10000,
          width: "300px", 
          height: "200px",
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden'
        }}
      />

      {/* Header with Call Timer and User Info */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '25px',
        padding: '10px 20px',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          color: '#fff',
          fontSize: '16px'
        }}>
          {otherUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>{otherUser.avatar || '👤'}</span>
              <span style={{ fontWeight: 'bold' }}>{otherUser.name}</span>
              <span style={{ color: '#ccc' }}>•</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: remoteUserJoined ? '#4ade80' : '#f59e0b',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
            <span style={{ fontWeight: 'bold' }}>
              {isCallActive ? formatDuration(callDuration) : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Main video area - Full screen for friend's video */}
      <div style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        height: '100%'
      }}>
        {/* Main Video Container - Full screen */}
        <div 
          ref={mainVideoContainerRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#2a2a2a',
            position: 'relative'
          }}
        >
          {!hasVideos && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#fff',
              textAlign: 'center'
            }}>
              <div style={{
                width: '100px',
                height: '100px',
                backgroundColor: '#444',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '40px'
              }}>
                {remoteUserJoined ? (otherUser?.avatar || '👤') : '📹'}
              </div>
              <p style={{ fontSize: '18px', margin: '0 0 10px 0' }}>
                {remoteUserJoined ? 'Setting up video...' : `Calling ${otherUser?.name || 'user'}...`}
              </p>
              <p style={{ fontSize: '14px', margin: 0, color: '#aaa' }}>
                {remoteUserJoined ? 'Please wait' : 'Waiting for them to answer'}
              </p>
            </div>
          )}
        </div>

        {/* Picture-in-Picture for Your Video (WhatsApp style) */}
        <div style={{
          position: 'absolute',
          bottom: '120px',
          right: '20px',
          width: '120px',
          height: '160px',
          backgroundColor: '#2a2a2a',
          borderRadius: '15px',
          overflow: 'hidden',
          border: '2px solid #fff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          zIndex: 100
        }}>
          <div 
            ref={pipVideoContainerRef}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#2a2a2a',
              position: 'relative'
            }}
          >
            {!hasVideos && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#fff',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#444',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 5px',
                  fontSize: '16px'
                }}>
                  👤
                </div>
                <p style={{ fontSize: '10px', margin: 0 }}>You</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp-style Controls */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '20px',
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '35px',
        padding: '15px 25px',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          style={{
            width: '55px',
            height: '55px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isMuted ? '#ef4444' : '#22c55e',
            color: '#fff',
            fontSize: '22px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        {/* Video Toggle Button */}
        <button
          onClick={toggleVideo}
          style={{
            width: '55px',
            height: '55px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: !isVideoOn ? '#ef4444' : '#3b82f6',
            color: '#fff',
            fontSize: '22px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          {isVideoOn ? '📹' : '📷'}
        </button>

        {/* End Call Button */}
        <button
          onClick={endCall}
          style={{
            width: '55px',
            height: '55px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '22px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          📞
        </button>
      </div>

      {/* Status Indicator */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '30px',
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '20px',
        padding: '8px 12px',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#fff',
          fontSize: '12px'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            backgroundColor: remoteUserJoined ? '#4ade80' : '#f59e0b',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}></div>
          <span>
            {remoteUserJoined ? 'Connected' : isCallActive ? 'Ringing...' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}