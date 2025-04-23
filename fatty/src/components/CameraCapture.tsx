"use client";

import { useEffect, useRef, useState } from 'react';
import { analyzeImage } from '@/api/gemini/client';

type ScanLog = {
  id: number;
  timestamp: string;
  response: string;
  classification: string;
};

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [classification, setClassification] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<ScanLog[]>([]);
  const [status, setStatus] = useState<string>('Idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const logCounter = useRef<number>(0);

  useEffect(() => {
    if (scanning) {
      startCamera();
      scheduleNextCapture(3000);
    } else {
      stopCamera();
      setStatus('Idle');
      clearCountdown();
    }
    return () => {
      stopCamera();
      clearCountdown();
    };
  }, [scanning]);

  const clearCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
  };

  const scheduleNextCapture = (delayMs: number) => {
    if (intervalRef.current) clearTimeout(intervalRef.current);
    setStatus('Cooldown');
    const secs = Math.floor(delayMs / 1000);
    setCountdown(secs);

    // start countdown interval
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev !== null) {
          if (prev <= 1) {
            clearCountdown();
            return null;
          }
          return prev - 1;
        }
        return null;
      });
    }, 1000);

    // schedule next capture
    intervalRef.current = window.setTimeout(async () => {
      await captureAndAnalyze();
      scheduleNextCapture(10000);
    }, delayMs);
  };

  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          zoom: 2,
          advanced: [{ torch: true }],
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      const constraintsToApply: MediaTrackConstraints = {};

      if (capabilities.zoom && capabilities.zoom.max >= 2) {
        constraintsToApply.zoom = 2;
      }
      if (capabilities.torch) {
        constraintsToApply.advanced = [{ torch: true }];
      }

      await track.applyConstraints(constraintsToApply);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach(t => t.stop());
    }
    if (intervalRef.current) clearTimeout(intervalRef.current);
  };

  const captureAndAnalyze = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];

    try {
      setStatus('Classification model working...');
      const classificationResult = await classifyObject(base64);
      setStatus('Gemini model working...');
      const geminiResult = await analyzeImage(classificationResult, base64);

      const timestamp = new Date().toLocaleString();
      const entry: ScanLog = {
        id: ++logCounter.current,
        timestamp,
        classification: classificationResult,
        response: geminiResult,
      };
      setLog(l => [entry, ...l]);
      setResponse(geminiResult);
      setStatus('Idle');
    } catch (err) {
      console.error('capture/analyze error', err);
      setStatus('Error during scan');
    }
  };

  const classifyObject = async (base64Image: string): Promise<string> => {
    const resp = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image }),
    });
    if (!resp.ok) throw new Error('Classification failed');
    const { classification } = await resp.json();
    const parts = classification.split(' ');
    const lastWord = parts[parts.length - 1];
    const formatted = lastWord.charAt(0).toUpperCase() + lastWord.slice(1);
    setClassification(formatted);
    return formatted;
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen text-black">
      <h1 className="text-2xl font-bold text-center mb-4 text-black">
        Auto Defect Scanner
      </h1>
      <div className="flex justify-center mb-2">
        {!scanning ? (
          <button
            onClick={() => setScanning(true)}
            className="px-4 py-2 bg-blue-500 text-black rounded shadow hover:bg-blue-600"
          >
            Start Scanning
          </button>
        ) : (
          <button
            onClick={() => setScanning(false)}
            className="px-4 py-2 bg-red-500 text-black rounded shadow hover:bg-red-600"
          >
            Stop Scanning
          </button>
        )}
      </div>
      {/* Status Bar */}
      <div className="flex justify-center mb-4">
        <div className="px-4 py-2 bg-yellow-200 rounded text-black">
          {status}
          {countdown !== null && ` - Next scan in ${countdown}s`}
        </div>
      </div>
      <div className="flex justify-center">
        <video
          ref={videoRef}
          className="w-full max-w-md rounded shadow"
          autoPlay
          playsInline
          muted
        />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {response && classification && (
        <div className="mt-4 bg-white p-4 rounded shadow text-black">
          <h2 className="text-lg font-semibold text-black">
            Latest Gemini Response:
          </h2>
          <p className="text-black">Classification: {classification}</p>
          <p className="text-black">Response: {response}</p>
        </div>
      )}
      {log.length > 0 && (
        <div className="mt-6 text-black">
          <h2 className="text-lg font-semibold mb-2 text-black">
            Scan History
          </h2>
          <div className="overflow-x-auto">
            <table className="table-auto w-full border-collapse border border-gray-300 text-black">
              <thead>
                <tr className="bg-gray-200 text-black">
                  <th className="border border-gray-300 px-4 py-2 text-black">#</th>
                  <th className="border border-gray-300 px-4 py-2 text-black">
                    Timestamp
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-black">
                    Classification
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-black">
                    Response
                  </th>
                </tr>
              </thead>
              <tbody>
                {log.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-100 text-black">
                    <td className="border border-gray-300 px-4 py-2 text-center text-black">
                      {entry.id}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-black">
                      {entry.timestamp}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-black">
                      {entry.classification}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-black">
                      {entry.response}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
