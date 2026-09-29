"use client";

import { useEffect, useRef, useState } from "react";

import { Callout } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";

import styles from "./posDialogs.module.css";

interface DetectedBarcode {
  readonly rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

function readBarcodeDetectorConstructor(): BarcodeDetectorConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector ?? null;
}

export function isCameraBarcodeScanningSupported(): boolean {
  return readBarcodeDetectorConstructor() !== null && typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function PosCameraScannerDialog({ isOpen, onDetected, onClose }: { readonly isOpen: boolean; readonly onDetected: (code: string) => void; readonly onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!isOpen) return;
    const DetectorConstructor = readBarcodeDetectorConstructor();
    if (!DetectorConstructor) {
      setErrorMessage("This browser cannot scan with the camera. Use a USB or Bluetooth scanner, or type the code.");
      return;
    }
    let mediaStream: MediaStream | null = null;
    let intervalHandle: number | null = null;
    let isStopped = false;
    setErrorMessage(null);
    const detector = new DetectorConstructor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (stream) => {
        mediaStream = stream;
        if (isStopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        intervalHandle = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          const barcodes = await detector.detect(videoRef.current).catch(() => []);
          const firstCode = barcodes[0]?.rawValue;
          if (firstCode && !isStopped) {
            isStopped = true;
            onDetectedRef.current(firstCode);
          }
        }, 250);
      })
      .catch(() => setErrorMessage("Camera access was blocked. Allow the camera for this site to scan."));
    return () => {
      isStopped = true;
      if (intervalHandle) window.clearInterval(intervalHandle);
      mediaStream?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen]);

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title="Scan with the camera" description="Hold the barcode inside the frame." width="medium">
      {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : <video ref={videoRef} className={styles.video} muted playsInline aria-label="Camera preview" />}
    </ModalDialog>
  );
}
