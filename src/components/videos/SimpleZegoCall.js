"use client"
import React, { useEffect, useRef, useState } from "react";
import { ZegoExpressEngine } from "zego-express-engine-webrtc";

const APP_ID = 1043089575;
const SERVER = "wss://webliveroom1043089575-api.zegocloud.com/ws";

// Use your working hardcoded token approach
const HARDCODED_TOKEN = `04AAAAGh9BNcADlh6Kosls4IBi6ReIwDNaevCklg1C9UUdJgekyBqTW9dw5Ig1UPebUzKVi o9J8a5+RxRpKOJsy1x3Gt97rRD/365j8XjctuJkadw0F7JCZJ66bmsksPzI+iqXVrDEu1QuZR RoozPFeBqodN1WmE9VZdUEpEdGMsLb4z9wBsyalwPmtD0NyMjDVp+NaWxfDMNRcBptrQ7dtCB FcQjS5LkOcZHW1sF5iiPmk1uQ2ApUCwXqez+MtcFiWDN2SK+Miwc6EnKe5J9IVBUSLr54t4cNd BypV46uFsS3GwE=`.replace(/\s+/g, ''); // Remove whitespace

export default function ZegoVideoCall({ userID, userName, roomID, onCallEnd }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const zgRef = useRef(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUserConnected, setRemoteUserConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userID || !roomID) return;

    const zg = new ZegoExpressEngine(APP_ID, SERVER);
    zgRef.current = zg;

    async function start() {
      try {
        console.log("=== Starting Video Call ===");
        console.log("APP_ID:", APP_ID);
        console.log("SERVER:", SERVER);
        console.log("roomID:", roomID);
        console.log("userID:", userID);
        console.log("userName:", userName);
        
        // Try to get a fresh token first
        let token = HARDCODED_TOKEN;
        
        try {
          console.log("🔑 Trying to generate fresh token...");
          const response = await fetch('/api/zego-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID, userName, roomID })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.token) {
              token = data.token;
              console.log("✅ Using fresh token");
            } else {
              console.log("⚠️ Fresh token failed, using hardcoded token");
            }
          } else {
            console.log("⚠️ Token API failed, using hardcoded token");
          }
        } catch (tokenErr) {
          console.log("⚠️ Token generation failed, using hardcoded token:", tokenErr.message);
        }
        
        console.log("Token length:", token.length);
        console.log("Token preview:", token.substring(0, 50) + "...");
        
        console.log("🔐 Attempting to login to room...");
        await zg.loginRoom(roomID, token, { 
          userID: userID, 
          userName: userName || "Anonymous" 
        });
        
        console.log("✅ Successfully logged in to room:", roomID);
        setIsCallActive(true);

        console.log("📹 Creating local stream...");
        const localStream = await zg.createStream({ camera: { video: true, audio: true } });
        
        if (localVideoRef.current) {
          console.log("📡 Publishing local stream...");
          await zg.startPublishingStream("local-stream-" + userID, localStream);
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play();
          console.log("✅ Local stream published successfully");
        }

        zg.on("roomStreamUpdate", async (roomID, updateType, streamList) => {
          console.log("🔄 Stream update:", { roomID, updateType, streamList });
          
          if (updateType === "ADD") {
            for (const stream of streamList) {
              try {
                console.log("➕ Adding remote stream:", stream.streamID);
                const remoteStream = await zg.startPlayingStream(stream.streamID);
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                  remoteVideoRef.current.play();
                  setRemoteUserConnected(true);
                  console.log("✅ Remote stream playing");
                }
              } catch (err) {
                console.error("❌ Error playing remote stream:", err);
              }
            }
          } else if (updateType === "DELETE") {
            console.log("➖ Remote stream deleted");
            setRemoteUserConnected(false);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = null;
            }
          }
        });

        console.log("✅ Video call setup completed successfully");

      } catch (err) {
        console.error("❌ Error in ZegoExpressEngine:", err);
        console.error("Error details:", JSON.stringify(err, null, 2));
        
        // Better error message extraction
        let errorMessage = "Unknown error occurred";
        
        if (err && typeof err === 'object') {
          if (err.message) {
            errorMessage = err.message;
          } else if (err.error) {
            errorMessage = err.error;
          } else if (err.code) {
            errorMessage = `Error code: ${err.code}`;
          } else if (err.msg) {
            errorMessage = err.msg;
          } else {
            // Try to extract meaningful info from the object
            const errorKeys = Object.keys(err);
            if (errorKeys.length > 0) {
              errorMessage = `Error: ${JSON.stringify(err)}`;
            }
          }
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        
        console.error("Extracted error message:", errorMessage);
        setError("Failed to join room: " + errorMessage);
      }
    }

    start();

    return () => {
      if (zgRef.current) {
        zgRef.current.destroyEngine();
      }
    };
  }, [userID, userName, roomID]);

  const toggleMute = async () => {
    if (zgRef.current) {
      try {
        await zgRef.current.mutePublishStreamAudio(!isMuted);
        setIsMuted(!isMuted);
      } catch (err) {
        console.error("Error toggling mute:", err);
      }
    }
  };

  const toggleVideo = async () => {
    if (zgRef.current) {
      try {
        await zgRef.current.mutePublishStreamVideo(!isVideoOff);
        setIsVideoOff(!isVideoOff);
      } catch (err) {
        console.error("Error toggling video:", err);
      }
    }
  };

  const endCall = () => {
    if (zgRef.current) {
      zgRef.current.destroyEngine();
    }
    setIsCallActive(false);
    if (onCallEnd) {
      onCallEnd();
    }
  };

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#fff',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '40px',
          borderRadius: '15px',
          textAlign: 'center',
          maxWidth: '500px',
          margin: '20px'
        }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 15px 0', color: '#ff4444' }}>Call Error</h3>
          <p style={{ margin: '0 0 30px 0', opacity: 0.8 }}>{error}</p>
          <button
            onClick={endCall}
            style={{
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              padding: '12px 30px',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Back to Call Menu
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
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        color: '#fff',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>
          Video Call
        </h2>
        <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
          {remoteUserConnected ? 'Connected' : 'Waiting for other user...'}
        </p>
      </div>

      {/* Video Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px 100px 20px',
        position: 'relative'
      }}>
        {/* Remote Video (Main) */}
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
          <video 
            ref={remoteVideoRef}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              backgroundColor: '#2a2a2a'
            }} 
            autoPlay 
            playsInline 
          />
          {!remoteUserConnected && (
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
              <p style={{ fontSize: '18px', margin: 0 }}>Waiting for user to join...</p>
            </div>
          )}
        </div>

        {/* Local Video (Picture-in-Picture) */}
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
          <video 
            ref={localVideoRef}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover'
            }} 
            autoPlay 
            playsInline 
            muted
          />
          {isVideoOff && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#fff',
              fontSize: '30px'
            }}>
              📹
            </div>
          )}
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
        zIndex: 1000
      }}>
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isMuted ? '#ff4444' : '#4a4a4a',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'scale(1)';
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
            backgroundColor: isVideoOff ? '#ff4444' : '#4a4a4a',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'scale(1)';
          }}
        >
          {isVideoOff ? '📹' : '📷'}
        </button>

        {/* End Call Button */}
        <button
          onClick={endCall}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#ff4444',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'scale(1)';
          }}
        >
          📞
        </button>
      </div>
    </div>
  );
}