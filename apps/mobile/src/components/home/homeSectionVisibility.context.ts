import { createContext, useContext } from "react";

export const HomeSectionVisibilityContext = createContext(true);

export function useIsHomeSectionOnScreen() {
  return useContext(HomeSectionVisibilityContext);
}
