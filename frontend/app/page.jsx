"use client";
import GlobalStyles from "./globals.css";
import { useEffect, useRef, useState } from "react";

export default function ProctorDashboard() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  const [warnings, setWarnings] = useState([]);
  const [faceCount, setFaceCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    let localStream = null;

    // 1. Initialize Web Camera
    navigator.mediaDevices
      ?.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      })
      .then((stream) => {
        localStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      })
      .catch((err) => {
        console.error("Camera access denied:", err);
        setCameraActive(false);
      });

    // 2. Python WebSocket Connection
    const ws = new WebSocket("ws://localhost:8000/ws/proctor");
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const incomingWarnings = data.warnings || [];
        setWarnings(incomingWarnings);
        setFaceCount(data.face_count ?? 0);

        if (incomingWarnings.length > 0) {
          const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          setIncidents((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              time: timestamp,
              message: incomingWarnings.join(", "),
            },
            ...prev.slice(0, 19),
          ]);
        }
      } catch (err) {
        console.error("Payload parse error:", err);
      }
    };

    // 3. Continuous Video Frame Dispatch (150ms interval)
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
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = canvas.toDataURL("image/jpeg", 0.5);
          ws.send(imageData);
        }
      }
    }, 150);

    return () => {
      clearInterval(interval);
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between antialiased selection:bg-zinc-800">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Navbar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center font-mono text-xs font-semibold text-zinc-200">
              PE
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-zinc-100">
                  ProctorEye
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  v2.4
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Session ID: #PR-88219
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Camera Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  cameraActive ? "bg-emerald-500" : "bg-zinc-600"
                }`}
              />
              <span>{cameraActive ? "Webcam Active" : "No Camera"}</span>
            </div>

            {/* Socket Pipeline Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs">
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isConnected ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
              </span>
              <span
                className={
                  isConnected ? "text-zinc-300" : "text-zinc-500 font-medium"
                }
              >
                {isConnected ? "Engine Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Center: Video Feed */}
          <section className="lg:col-span-8 flex flex-col gap-3">
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/90 shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Viewport Framing Brackets */}
              <div className="absolute inset-8 sm:inset-14 border border-dashed border-zinc-600/40 rounded-lg pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-t-2 border-l-2 border-zinc-400/60" />
                  <span className="w-3 h-3 border-t-2 border-r-2 border-zinc-400/60" />
                </div>
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-b-2 border-l-2 border-zinc-400/60" />
                  <span className="w-3 h-3 border-b-2 border-r-2 border-zinc-400/60" />
                </div>
              </div>

              {/* Active Warning Overlay Bar */}
              {warnings.length > 0 && (
                <div className="absolute top-3 inset-x-3 z-10">
                  <div className="bg-rose-950/90 backdrop-blur-md border border-rose-600/40 px-3.5 py-2.5 rounded-lg flex items-center gap-3 shadow-md">
                    <svg
                      className="w-5 h-5 text-rose-400 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <div className="text-xs sm:text-sm font-medium text-rose-100">
                      {warnings.join(" • ")}
                    </div>
                  </div>
                </div>
              )}

              {/* Camera Metadata Overlay */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono text-zinc-400 border border-white/5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>REC</span>
                <span className="text-zinc-600">|</span>
                <span>720p 30fps</span>
              </div>
            </div>

            <p className="text-xs text-zinc-500 px-1">
              Ensure your entire face remains centered inside the guide markers.
              Background noise and side profiles are flagged automatically.
            </p>
          </section>

          {/* Right: Telemetry & Log Console */}
          <section className="lg:col-span-4 flex flex-col gap-4">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                  Faces Detected
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
                    {faceCount}
                  </span>
                  <span className="text-xs text-zinc-500 font-normal">
                    {faceCount === 1
                      ? "Target lock"
                      : faceCount > 1
                      ? "Multi-face"
                      : "Empty"}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                  Session State
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      warnings.length === 0 ? "bg-emerald-400" : "bg-rose-400"
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      warnings.length === 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {warnings.length === 0 ? "Compliant" : "Flagged"}
                  </span>
                </div>
              </div>
            </div>

            {/* Incidents Log Box */}
            <div className="rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-col h-[320px]">
              <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
                  Incident Audit Log
                </h3>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {incidents.length} events
                </span>
              </div>

              <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-2 font-mono text-xs">
                {incidents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center p-4 font-sans">
                    <svg
                      className="w-8 h-8 mb-2 opacity-40"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-xs text-zinc-400">No anomalies detected</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Stream is clear and verified
                    </p>
                  </div>
                ) : (
                  incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="p-2.5 rounded-lg bg-zinc-900/90 border border-rose-950/60 flex items-start gap-2.5"
                    >
                      <span className="text-[10px] text-zinc-500 shrink-0 mt-0.5">
                        {incident.time}
                      </span>
                      <span className="text-rose-300 font-sans text-xs flex-1 leading-snug">
                        {incident.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-3 text-center">
        <p className="text-[11px] text-zinc-500">
          Encrypted WebRTC / WebSocket Pipe • End-to-End Evaluation Active
        </p>
      </footer>
    </div>
  );
}