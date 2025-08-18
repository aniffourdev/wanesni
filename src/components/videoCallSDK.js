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
            if (users && users.length === 0) {
              setRemoteUserJoined(false);
            }
          },
          onReturnToHomeScreenClicked: handleCallEnd,
        });

        // Wait a bit for ZegoCloud to initialize videos, then move them
        setTimeout(() => {
          if (mounted && !cleanupRef.current) {
            moveZegoVideos();
          }
        }, 2000);

        setTimeout(() => {
          if (mounted && !cleanupRef.current) {
            moveZegoVideos();
          }
        }, 4000);

        setTimeout(() => {
          if (mounted && !cleanupRef.current) {
            moveZegoVideos();
          }
        }, 6000);

        console.log('✅ Video call initialized');
        initializingRef.current = false;

      } catch (error) {
        console.error('❌ Error initializing video call:', error);
        initializingRef.current = false;
      }
    };

    // FIXED: Function to move ZegoCloud videos to our custom containers
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
            console.log(`✅ Processing video ${index}`, {
              muted: video.muted,
              hasAudio: video.srcObject.getAudioTracks().length > 0,
              hasVideo: video.srcObject.getVideoTracks().length > 0
            });
            
            // Clone the video element
            const clonedVideo = video.cloneNode(true);
            clonedVideo.srcObject = video.srcObject;
            clonedVideo.autoplay = true;
            clonedVideo.playsInline = true;
            clonedVideo.style.width = '100%';
            clonedVideo.style.height = '100%';
            clonedVideo.style.objectFit = 'cover';

            // Check if this is local video (usually muted) or remote video
            const isLocalVideo = video.muted || video.hasAttribute('muted');
            
            if (isLocalVideo && !localVideoMoved) {
              // This is the local video - show it in PiP when remote user joins
              console.log(`📹 Moving LOCAL video ${index} to PiP container`);
              clonedVideo.muted = true; // Ensure local video is muted to prevent feedback
              clonedVideo.style.transform = 'scaleX(-1)'; // Mirror local video
              
              if (pipVideoContainerRef.current) {
                pipVideoContainerRef.current.innerHTML = '';
                pipVideoContainerRef.current.appendChild(clonedVideo);
                localVideoMoved = true;
                setZegoVideoFound(true);
                clonedVideo.play().catch(e => console.log('Local video play error:', e));
              }
              
              // If no remote user yet, also show local video in main view
              if (mainVideoContainerRef.current && !remoteUserJoined) {
                const mainClone = clonedVideo.cloneNode(true);
                mainClone.srcObject = video.srcObject;
                mainClone.muted = true;
                mainClone.style.transform = 'scaleX(-1)';
                mainVideoContainerRef.current.innerHTML = '';
                mainVideoContainerRef.current.appendChild(mainClone);
                mainClone.play().catch(e => console.log('Main local video play error:', e));
              }
              
            } else if (!isLocalVideo && !remoteVideoMoved) {
              // This is the remote video - show it in main view
              console.log(`📹 Moving REMOTE video ${index} to main container`);
              clonedVideo.muted = false; // Remote video should NOT be muted for audio
              clonedVideo.style.transform = 'none'; // Don't mirror remote video
              
              if (mainVideoContainerRef.current) {
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

        // If no videos found yet and we haven't given up, keep trying
        if (!zegoVideoFound && !cleanupRef.current) {
          setTimeout(moveZegoVideos, 3000);
        }
      } catch (error) {
        console.log('Video move error:', error);
        if (!zegoVideoFound && !cleanupRef.current) {
          setTimeout(moveZegoVideos, 3000);
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

  // FIXED: Mute/unmute functionality
  const toggleMute = async () => {
    if (zpRef.current && !cleanupRef.current) {
      try {
        // Use ZegoCloud's built-in mute/unmute methods
        const newMutedState = !isMuted;
        await zpRef.current.enableMicrophone(!newMutedState);
        setIsMuted(newMutedState);
        console.log(`🎤 Microphone ${newMutedState ? 'muted' : 'unmuted'}`);
      } catch (error) {
        console.error('❌ Error toggling microphone:', error);
      }
    }
  };

  // FIXED: Video on/off functionality
  const toggleVideo = async () => {
    if (zpRef.current && !cleanupRef.current) {
      try {
        // Use ZegoCloud's built-in camera methods
        const newVideoState = !isVideoOn;
        await zpRef.current.enableCamera(newVideoState);
        setIsVideoOn(newVideoState);
        console.log(`📹 Camera ${newVideoState ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('❌ Error toggling camera:', error);
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
              backgroundColor: isCallActive ? '#4ade80' : '#ef4444',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
            <span style={{ fontWeight: 'bold' }}>{formatDuration(callDuration)}</span>
          </div>
        </div>
      </div>

      {/* Main video area - Full screen for remote user */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
                {otherUser?.avatar || '👤'}
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

        {/* Picture-in-Picture for Local Video - Always visible */}
        <div style={{
          position: 'absolute',
          bottom: '120px', // Above the controls
          right: '20px',
          width: '150px',
          height: '200px',
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
              backgroundColor: '#2a2a2a',
              position: 'relative'
            }}
          >
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
                  width: '50px',
                  height: '50px',
                  backgroundColor: '#444',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  fontSize: '20px'
                }}>
                  👤
                </div>
                <p style={{ fontSize: '12px', margin: 0 }}>You</p>
              </div>
            )}
          </div>
        </div>
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
          <span>
            {remoteUserJoined ? 'Connected' : isCallActive ? 'Ringing...' : 'Connecting...'}
          </span>
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