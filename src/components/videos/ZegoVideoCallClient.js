"use client";
import dynamic from "next/dynamic";

const ZegoVideoCall = dynamic(() => import("./ZegoVideoCall"), { ssr: false });

export default function ZegoVideoCallClient(props) {
  return <ZegoVideoCall {...props} />;
}