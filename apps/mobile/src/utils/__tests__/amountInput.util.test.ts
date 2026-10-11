import { parseMajorAmountToMinorUnits } from "../amountInput.util";

describe("parseMajorAmountToMinorUnits", () => {
  it.each([
    ["1,000", 100_000],
    ["50,000.50", 5_000_050],
    [" 2500.5 ", 250_050],
    ["0.29", 29],
  ])("reads %s as %d minor units", (text, minor) => {
    expect(parseMajorAmountToMinorUnits(text)).toBe(minor);
  });

  it.each(["", "12abc", "1e5", "-100", "1,00", "1.234", "Infinity", "0x10", "1 000", "99999999999999999999"])("refuses %s", (text) => {
    expect(parseMajorAmountToMinorUnits(text)).toBeNull();
  });
});
