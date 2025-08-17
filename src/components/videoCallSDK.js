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
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const [zegoVideoFound, setZegoVideoFound] = useState(false);

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
          if (users && users.length > 0) {
            setRemoteUserJoined(true);
          }
        };

        const handleCallEnd = () => {
          console.log('📴 Call ended');
          if (!cleanupRef.current && onCallEnd) {
            cleanupRef.current = true;
            onCallEnd();
          }
        };

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
          showMyCameraToggleButton: false,
          showMyMicrophoneToggleButton: false,
          showAudioVideoSettingsButton: false,
          onJoinRoom: handleUserJoin,
          onLeaveRoom: handleCallEnd,
          onUserJoin: handleUserJoin,
          onUserLeave: (users) => {
            console.log('👋 Users left:', users);
            setRemoteUserJoined(false);
          },
          onReturnToHomeScreenClicked: handleCallEnd,
        });

        // Move ZegoCloud videos to our custom containers
        setTimeout(() => {
          if (mounted && !cleanupRef.current) {
            moveZegoVideos();
          }
        }, 1000);

        setTimeout(() => {
          if (mounted && !cleanupRef.current) {
            moveZegoVideos();
          }
        }, 3000);

        setTimeout(() => {
          if (mounted && !cleanupRef.current) {
            moveZegoVideos();
          }
        }, 5000);

        console.log('✅ Video call initialized');
        initializingRef.current = false;

      } catch (error) {
        console.error('❌ Error initializing video call:', error);
        initializingRef.current = false;
      }
    };

    // Function to move ZegoCloud videos to our custom containers
    const moveZegoVideos = () => {
      try {
        const zegoContainer = zegoContainerRef.current;
        if (!zegoContainer) return;

        // Find all video elements
        const videos = document.querySelectorAll('video');
        console.log(`📹 Found ${videos.length} total videos`);

        let localVideoMoved = false;
        let remoteVideoMoved = false;

        videos.forEach((video, index) => {
          if (video.srcObject && video.srcObject.getVideoTracks().length > 0) {
            console.log(`✅ Processing video ${index}`);
            
            // Clone the video element
            const clonedVideo = video.cloneNode(true);
            clonedVideo.srcObject = video.srcObject;
            clonedVideo.autoplay = true;
            clonedVideo.playsInline = true;
            clonedVideo.style.width = '100%';
            clonedVideo.style.height = '100%';
            clonedVideo.style.objectFit = 'cover';
            clonedVideo.style.transform = 'scaleX(-1)';

            // Check if this is local video (usually muted) or remote video
            const isLocalVideo = video.muted || video.hasAttribute('muted');
            
            if (isLocalVideo && !localVideoMoved) {
              // This is the local video - show it when no remote user
              console.log(`📹 Moving LOCAL video ${index} to main container`);
              if (mainVideoContainerRef.current && !remoteUserJoined) {
                clonedVideo.muted = true;
                mainVideoContainerRef.current.innerHTML = '';
                mainVideoContainerRef.current.appendChild(clonedVideo);
                localVideoMoved = true;
                setZegoVideoFound(true);
                setIsCallActive(true);
                clonedVideo.play().catch(e => console.log('Local video play error:', e));
              }
            } else if (!isLocalVideo && !remoteVideoMoved) {
              // This is the remote video - prioritize this for main view
              console.log(`📹 Moving REMOTE video ${index} to main container`);
              if (mainVideoContainerRef.current) {
                clonedVideo.muted = false;
                mainVideoContainerRef.current.innerHTML = '';
                mainVideoContainerRef.current.appendChild(clonedVideo);
                remoteVideoMoved = true;
                setZegoVideoFound(true);
                setIsCallActive(true);
                setRemoteUserJoined(true);
                clonedVideo.play().catch(e => console.log('Remote video play error:', e));
              }
            }
          }
        });

        // If we found videos, log the status
        if (localVideoMoved || remoteVideoMoved) {
          console.log(`✅ Video move complete - Local: ${localVideoMoved}, Remote: ${remoteVideoMoved}`);
        }

        // Keep trying if no videos found yet
        if (!zegoVideoFound && !cleanupRef.current) {
          setTimeout(moveZegoVideos, 2000);
        }
      } catch (error) {
        console.log('Video move error:', error);
        if (!zegoVideoFound && !cleanupRef.current) {
          setTimeout(moveZegoVideos, 2000);
        }
      }
    };

    initializeCall();

    return () => {
      mounted = false;
      cleanupRef.current = true;
      initializingRef.current = false;
      setIsCallActive(false);
      
      if (zpRef.current) {
        setTimeout(() => {
          try {
            if (zpRef.current) {
              zpRef.current.destroy();
              zpRef.current = null;
            }
          } catch (error) {
            console.log('Cleanup error:', error);
          }
        }, 100);
      }
    };
  }, [roomId, userName]);

  const toggleMute = () => {
    if (zpRef.current && !cleanupRef.current) {
      setIsMuted(!isMuted);
      try {
        const zegoContainer = zegoContainerRef.current;
        const muteButton = zegoContainer?.querySelector('[data-testid*="microphone"], [aria-label*="microphone"], button[title*="microphone"]');
        if (muteButton) {
          muteButton.click();
        }
      } catch (error) {
        console.log('Mute error:', error);
      }
    }
  };

  const toggleVideo = () => {
    if (zpRef.current && !cleanupRef.current) {
      setIsVideoOn(!isVideoOn);
      try {
        const zegoContainer = zegoContainerRef.current;
        const videoButton = zegoContainer?.querySelector('[data-testid*="camera"], [aria-label*="camera"], button[title*="camera"]');
        if (videoButton) {
          videoButton.click();
        }
      } catch (error) {
        console.log('Video toggle error:', error);
      }
    }
  };

  const endCall = () => {
    if (cleanupRef.current) return;
    cleanupRef.current = true;
    
    setIsCallActive(false);
    setZegoVideoFound(false);
    setRemoteUserJoined(false);
    
    if (zpRef.current) {
      setTimeout(() => {
        try {
          if (zpRef.current) {
            zpRef.current.destroy();
            zpRef.current = null;
          }
        } catch (error) {
          console.log('End call cleanup error:', error);
        }
        
        if (onCallEnd) {
          onCallEnd();
        }
      }, 300);
    } else if (onCallEnd) {
      onCallEnd();
    }
  };

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
      {/* ZegoCloud Container - Completely hidden */}
      <div 
        ref={zegoContainerRef}
        style={{ 
          position: 'absolute',
          top: -10000,
          left: -10000,
          width: "100px", 
          height: "100px",
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden'
        }}
      />

      {/* Header with Call Timer */}
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
          gap: '10px',
          color: '#fff',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: isCallActive ? '#4ade80' : '#ef4444',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}></div>
          <span>{formatDuration(callDuration)}</span>
        </div>
      </div>

      {/* Main video area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px 100px 20px',
        position: 'relative'
      }}>
        {/* Main Video Container */}
        <div style={{
          width: '100%',
          maxWidth: '800px',
          height: '60vh',
          backgroundColor: '#2a2a2a',
          borderRadius: '20px',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          {/* Custom video container where ZegoCloud videos will be moved */}
          <div 
            ref={mainVideoContainerRef}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#2a2a2a'
            }}
          />
          
          {!zegoVideoFound && (
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
                👤
              </div>
              <p style={{ fontSize: '18px', margin: 0 }}>Connecting to video...</p>
            </div>
          )}
        </div>

        {/* Picture-in-Picture for Local Video (when remote user is present) */}
        {remoteUserJoined && (
          <div style={{
            position: 'absolute',
            top: '100px',
            right: '30px',
            width: '200px',
            height: '150px',
            backgroundColor: '#2a2a2a',
            borderRadius: '15px',
            overflow: 'hidden',
            border: '3px solid #fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 100
          }}>
            <div 
              ref={pipVideoContainerRef}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#2a2a2a'
              }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
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
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isMuted ? '#ef4444' : '#22c55e',
            color: '#fff',
            fontSize: '24px',
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
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: !isVideoOn ? '#ef4444' : '#3b82f6',
            color: '#fff',
            fontSize: '24px',
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
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '24px',
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
        padding: '10px 15px',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fff',
          fontSize: '14px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: isCallActive ? '#4ade80' : '#f59e0b',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}></div>
          <span>{isCallActive ? 'Connected' : 'Connecting...'}</span>
        </div>
      </div>

      {/* CSS for pulse animation */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}