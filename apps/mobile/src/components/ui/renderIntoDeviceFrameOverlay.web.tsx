import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function renderIntoDeviceFrameOverlay(content: ReactNode, overlayRootElement: HTMLElement) {
  return createPortal(content, overlayRootElement);
}
