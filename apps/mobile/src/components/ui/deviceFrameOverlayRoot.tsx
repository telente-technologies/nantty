import { createContext, useContext } from "react";

export const DeviceFrameOverlayRootContext = createContext<HTMLElement | null>(null);

export const useDeviceFrameOverlayRootElement = () => useContext(DeviceFrameOverlayRootContext);
