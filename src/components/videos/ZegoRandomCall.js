import React, { useRef, useEffect } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

function randomID(len = 5) {
  const chars = "12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getRoomID(fallback) {
  if (fallback) return fallback;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    return params.get("roomID") || randomID(5);
  }
  return randomID(5);
}

export default function ZegoRandomCall({ roomID, userName }) {
  const callContainerRef = useRef(null);
  const zpRef = useRef(null);

  useEffect(() => {
    if (!callContainerRef.current) return;

    const appID = 1043089575;
    const serverSecret = "de73ca1d2ccf7ac08c56ddb810ae8c3b";
    const finalRoomID = getRoomID(roomID);
    const userID = randomID(8);

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      finalRoomID,
      userID,
      userName
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zpRef.current = zp;
    zp.joinRoom({
      container: callContainerRef.current,
      sharedLinks: [
        {
          name: "Personal link",
          url:
            window.location.protocol +
            "//" +
            window.location.host +
            window.location.pathname +
            "?roomID=" +
            finalRoomID,
        },
      ],
      scenario: {
        mode: ZegoUIKitPrebuilt.GroupCall,
      },
      showPreJoinView: false,
    });

    // Cleanup on unmount: leave/destroy the room
    return () => {
      if (zpRef.current) {
        try {
          zpRef.current.leaveRoom();
        } catch (e) {
          console.error("Error leaving room:", e);
        }
        try {
          zpRef.current.destroy();
        } catch (e) {
          console.error("Error destroying room:", e);
        }
      }
    };
  }, [roomID, userName]);

  return (
    <div
      ref={callContainerRef}
      style={{ width: "100vw", height: "100vh" }}
    ></div>
  );
}