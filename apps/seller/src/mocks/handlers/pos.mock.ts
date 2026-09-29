import { registerPosExtrasMockHandlers } from "@/mocks/handlers/posExtras.mock";
import { registerPosSaleMockHandlers } from "@/mocks/handlers/posSales.mock";
import { registerPosShiftMockHandlers } from "@/mocks/handlers/posShifts.mock";

export function registerPosMockHandlers(): void {
  registerPosShiftMockHandlers();
  registerPosSaleMockHandlers();
  registerPosExtrasMockHandlers();
}
