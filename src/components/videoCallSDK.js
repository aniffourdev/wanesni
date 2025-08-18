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
  const keepAliveRef = useRef(null);
  const videoCheckIntervalRef = useRef(null);
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const [zegoVideoFound, setZegoVideoFound] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

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

        // Keep connection alive
        keepAliveRef.current = setInterval(() => {
          if (zpRef.current && !cleanupRef.current) {
            console.log('💓 Keeping call alive...');
          }
        }, 30000);

        const handleUserJoin = (users) => {
          console.log('✅ Users joined:', users);
          setIsCallActive(true);
          if (users && users.length > 1) {
            setRemoteUserJoined(true);
            console.log('👥 Remote user joined, will setup videos...');
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
            if (users && users.length <= 1) {
              setRemoteUserJoined(false);
              setHasRemoteVideo(false);
            }
          },
          onReturnToHomeScreenClicked: handleCallEnd,
          onError: handleError,
          // Audio/Video config
          videoConfig: {
            quality: 'medium', // Changed from 'high' to 'medium' for better stability
          },
          audioConfig: {
            quality: 'high',
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true, // Added for better audio
          },
        });

        setIsCallActive(true);

        // Start video detection interval - more robust approach
        videoCheckIntervalRef.current = setInterval(() => {
          if (mounted && !cleanupRef.current) {
            detectAndMoveVideos();
          }
        }, 2000);

        console.log('✅ Video call initialized');
        initializingRef.current = false;

      } catch (error) {
        console.error('❌ Error initializing video call:', error);
        setConnectionError(`Failed to start call: ${error.message}`);
        initializingRef.current = false;
      }
    };

    // FIXED: More robust video detection and separation
    const detectAndMoveVideos = () => {
      try {
        if (!zegoContainerRef.current || !mainVideoContainerRef.current || !pipVideoContainerRef.current) {
          return;
        }

        // Find all video elements in the entire document
        const allVideos = Array.from(document.querySelectorAll('video')).filter(video => {
          return video.srcObject && 
                 video.srcObject.getVideoTracks && 
                 video.srcObject.getVideoTracks().length > 0;
        });

        console.log(`📹 Found ${allVideos.length} active videos`);

        if (allVideos.length === 0) {
          return;
        }

        let localVideo = null;
        let remoteVideo = null;

        // Better detection logic
        allVideos.forEach((video, index) => {
          const stream = video.srcObject;
          const videoTrack = stream.getVideoTracks()[0];
          const audioTracks = stream.getAudioTracks();
          
          console.log(`Video ${index}:`, {
            muted: video.muted,
            videoTrackLabel: videoTrack?.label,
            audioTracksCount: audioTracks.length,
            width: video.videoWidth,
            height: video.videoHeight
          });

          // More reliable local/remote detection
          // Local video is usually auto-muted by the browser to prevent feedback
          // Remote video should NOT be muted so you can hear the other person
          if (video.muted) {
            localVideo = video;
          } else {
            remoteVideo = video;
          }
        });

        // Fallback: if we have videos but detection failed, assign based on count
        if (!localVideo && !remoteVideo && allVideos.length > 0) {
          localVideo = allVideos[0];
          if (allVideos.length > 1) {
            remoteVideo = allVideos[1];
          }
        }

        // Setup video display
        setupVideoDisplay(localVideo, remoteVideo);

      } catch (error) {
        console.error('❌ Video detection error:', error);
      }
    };

    const setupVideoDisplay = (localVideo, remoteVideo) => {
      try {
        // Clear existing videos first
        if (mainVideoContainerRef.current) {
          mainVideoContainerRef.current.innerHTML = '';
        }
        if (pipVideoContainerRef.current) {
          pipVideoContainerRef.current.innerHTML = '';
        }

        let videoSetup = false;

        if (remoteUserJoined && remoteVideo) {
          // Show remote video in main container
          console.log('📺 Setting up remote video in main container');
          const remoteClone = createVideoElement(remoteVideo, {
            muted: false, // IMPORTANT: Don't mute remote video for audio
            mirrored: false,
            width: '100%',
            height: '100%'
          });
          
          mainVideoContainerRef.current.appendChild(remoteClone);
          setHasRemoteVideo(true);
          videoSetup = true;

          // Show local video in PiP
          if (localVideo) {
            console.log('📺 Setting up local video in PiP');
            const localClone = createVideoElement(localVideo, {
              muted: true, // Mute local video to prevent feedback
              mirrored: true,
              width: '100%',
              height: '100%'
            });
            
            pipVideoContainerRef.current.appendChild(localClone);
            setHasLocalVideo(true);
          }

        } else if (localVideo) {
          // Only local user - show in main container
          console.log('📺 Setting up local video in main container (alone)');
          const localClone = createVideoElement(localVideo, {
            muted: true,
            mirrored: true,
            width: '100%',
            height: '100%'
          });
          
          mainVideoContainerRef.current.appendChild(localClone);
          setHasLocalVideo(true);
          videoSetup = true;

          // Also show in PiP for consistency
          const pipClone = createVideoElement(localVideo, {
            muted: true,
            mirrored: true,
            width: '100%',
            height: '100%'
          });
          
          pipVideoContainerRef.current.appendChild(pipClone);
        }

        if (videoSetup) {
          setZegoVideoFound(true);
        }

      } catch (error) {
        console.error('❌ Video setup error:', error);
      }
    };

    const createVideoElement = (sourceVideo, options = {}) => {
      const clone = sourceVideo.cloneNode(true);
      clone.srcObject = sourceVideo.srcObject;
      clone.autoplay = true;
      clone.playsInline = true;
      clone.muted = options.muted || false;
      clone.style.width = options.width || '100%';
      clone.style.height = options.height || '100%';
      clone.style.objectFit = 'cover';
      clone.style.transform = options.mirrored ? 'scaleX(-1)' : 'none';
      
      // Better mobile support
      clone.setAttribute('webkit-playsinline', 'true');
      clone.setAttribute('playsinline', 'true');
      
      // Auto-play with error handling
      clone.play().catch(e => {
        console.log('Video play error (normal on some browsers):', e.message);
      });
      
      return clone;
    };

    initializeCall();

    return () => {
      mounted = false;
      cleanupRef.current = true;
      initializingRef.current = false;
      
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      
      if (videoCheckIntervalRef.current) {
        clearInterval(videoCheckIntervalRef.current);
        videoCheckIntervalRef.current = null;
      }
      
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
  }, [roomId, userName, remoteUserJoined]); // Added remoteUserJoined as dependency

  // FIXED: Better mute toggle with error handling
  const toggleMute = async () => {
    if (!zpRef.current || cleanupRef.current) {
      console.warn('❌ Cannot toggle mute - ZegoCloud not ready');
      return;
    }

    try {
      const newMutedState = !isMuted;
      console.log(`🎤 ${newMutedState ? 'Muting' : 'Unmuting'} microphone...`);
      
      // Use the correct ZegoCloud API method
      if (newMutedState) {
        await zpRef.current.muteMicrophone(true);
      } else {
        await zpRef.current.muteMicrophone(false);
      }
      
      setIsMuted(newMutedState);
      console.log(`✅ Microphone ${newMutedState ? 'muted' : 'unmuted'} successfully`);
      
    } catch (error) {
      console.error('❌ Error toggling microphone:', error);
      alert('Could not toggle microphone. Please check permissions.');
    }
  };

  // FIXED: Better camera toggle with error handling
  const toggleVideo = async () => {
    if (!zpRef.current || cleanupRef.current) {
      console.warn('❌ Cannot toggle video - ZegoCloud not ready');
      return;
    }

    try {
      const newVideoState = !isVideoOn;
      console.log(`📹 ${newVideoState ? 'Enabling' : 'Disabling'} camera...`);
      
      // Use the correct ZegoCloud API method
      if (newVideoState) {
        await zpRef.current.muteVideoStream(false);
      } else {
        await zpRef.current.muteVideoStream(true);
      }
      
      setIsVideoOn(newVideoState);
      console.log(`✅ Camera ${newVideoState ? 'enabled' : 'disabled'} successfully`);
      
    } catch (error) {
      console.error('❌ Error toggling camera:', error);
      alert('Could not toggle camera. Please check permissions.');
    }
  };

  const endCall = () => {
    if (cleanupRef.current) return;
    cleanupRef.current = true;
    
    console.log('📴 Ending call...');
    
    setIsCallActive(false);
    setZegoVideoFound(false);
    setRemoteUserJoined(false);
    setHasLocalVideo(false);
    setHasRemoteVideo(false);
    
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    
    if (videoCheckIntervalRef.current) {
      clearInterval(videoCheckIntervalRef.current);
      videoCheckIntervalRef.current = null;
    }
    
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
      {/* ZegoCloud Container - Hidden */}
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

      {/* Main video area - Full screen */}
      <div style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        height: '100%'
      }}>
        {/* Main Video Container - Full screen for remote user */}
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

        {/* Picture-in-Picture for Local Video */}
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
            {!hasLocalVideo && (
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

      {/* Controls */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '15px',
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '35px',
        padding: '15px 20px',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isMuted ? '#ef4444' : '#22c55e',
            color: '#fff',
            fontSize: '20px',
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
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: !isVideoOn ? '#ef4444' : '#3b82f6',
            color: '#fff',
            fontSize: '20px',
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
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '20px',
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
            backgroundColor: isCallActive ? '#4ade80' : '#f59e0b',
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