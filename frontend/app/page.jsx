"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  const [warnings, setWarnings] = useState([]);
  const [faceCount, setFaceCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 1. Web Camera Start
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error("Camera access denied:", err));

    // 2. Python WebSocket Server se Connect karo
    const ws = new WebSocket("ws://localhost:8000/ws/proctor");
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setWarnings(data.warnings || []);
      setFaceCount(data.face_count || 0);
    };

    // 3. Continuous Video Frames Python Backend Ko Bhejo (Every 150ms)
    const interval = setInterval(() => {
      if (
        videoRef.current &&
        canvasRef.current &&
        ws.readyState === WebSocket.OPEN
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (context && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // Draw video frame on hidden canvas
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Frame ko JPEG Base64 me convert karo
          const imageData = canvas.toDataURL("image/jpeg", 0.5);
          ws.send(imageData);
        }
      }
    }, 150);

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-2">Smart AI Proctoring Demo</h1>
      <p className="text-slate-400 mb-6">
        Backend Status: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
      </p>

      {/* Camera Box */}
      <div className="relative border-4 border-slate-700 rounded-2xl overflow-hidden shadow-2xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-[640px] h-[480px] object-cover scale-x-[-1]"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Warning Alert Banner */}
        {warnings.length > 0 && (
          <div className="absolute top-4 left-4 right-4 bg-red-600/90 text-white px-4 py-3 rounded-lg text-center font-bold text-lg animate-pulse shadow-lg">
            ⚠️ WARNING: {warnings.join(" | ")}
          </div>
        )}
      </div>

      {/* Live Analytics Bar */}
      <div className="mt-6 bg-slate-900 border border-slate-800 p-4 rounded-xl w-full max-w-xl flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-400">Faces Detected:</p>
          <p className="text-2xl font-bold text-blue-400">{faceCount}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Proctor Status:</p>
          <p
            className={`text-lg font-bold ${
              warnings.length === 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {warnings.length === 0 ? "✅ Normal" : "🚨 Violation Detected"}
          </p>
        </div>
      </div>
    </div>
  );
}