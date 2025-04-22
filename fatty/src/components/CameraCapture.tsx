"use client";

import { useEffect, useRef, useState } from 'react';
import { analyzeImage } from '@/api/gemini/client';

type ScanLog = {
  id: number;
  timestamp: string;
  response: string;
};

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<ScanLog[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const logCounter = useRef<number>(0);

  useEffect(() => {
    if (scanning) {
      startCamera();
      const timeout = setTimeout(() => {
        captureAndAnalyze();
        intervalRef.current = setInterval(captureAndAnalyze, 10000);
      }, 3000);
      return () => {
        clearTimeout(timeout);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [scanning]);

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
      console.error("Error accessing camera:", error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const captureAndAnalyze = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext("2d");
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL("image/jpeg").split(",")[1];
        const result = await analyzeImage(base64Image);

        const timestamp = new Date().toLocaleString();
        const newEntry: ScanLog = {
          id: ++logCounter.current,
          timestamp,
          response: result,
        };

        setLog((prev) => [newEntry, ...prev]);
        setResponse(result);
      }
    }
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen text-black">
      <h1 className="text-2xl font-bold text-center mb-4 text-black">Auto Defect Scanner</h1>
      <div className="flex justify-center mb-4">
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
      {response && (
        <div className="mt-4 bg-white p-4 rounded shadow text-black">
          <h2 className="text-lg font-semibold text-black">Latest Gemini Response:</h2>
          <p className="text-black">{response}</p>
        </div>
      )}
      {log.length > 0 && (
        <div className="mt-6 text-black">
          <h2 className="text-lg font-semibold mb-2 text-black">Scan History</h2>
          <div className="overflow-x-auto">
            <table className="table-auto w-full border-collapse border border-gray-300 text-black">
              <thead>
                <tr className="bg-gray-200 text-black">
                  <th className="border border-gray-300 px-4 py-2 text-black">#</th>
                  <th className="border border-gray-300 px-4 py-2 text-black">Timestamp</th>
                  <th className="border border-gray-300 px-4 py-2 text-black">Response</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-100 text-black">
                    <td className="border border-gray-300 px-4 py-2 text-center text-black">
                      {entry.id}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-black">
                      {entry.timestamp}
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
