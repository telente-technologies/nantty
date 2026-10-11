import { pollPaymentUntilSettled, type PolledPaymentStatus } from "../paymentPolling.util";

const clock = () => {
  let time = 0;
  return { now: () => time, sleep: async (ms: number) => void (time += ms) };
};

describe("payment polling after the hosted checkout closes", () => {
  it("trusts only the server: a failed verify wins even if the redirect said success", async () => {
    const { now, sleep } = clock();
    const results: PolledPaymentStatus[] = ["pending", "failed"];
    const outcome = await pollPaymentUntilSettled({ check: async () => results.shift() ?? "pending", isOnline: () => true, now, sleep });
    expect(outcome).toBe("failed");
  });

  it("pauses while offline without timing out, then resumes", async () => {
    const { now, sleep } = clock();
    let online = false;
    let offlineTicks = 0;
    const changes: boolean[] = [];
    const outcome = await pollPaymentUntilSettled({
      check: async () => "paid",
      isOnline: () => {
        if (!online && ++offlineTicks > 100) online = true;
        return online;
      },
      onOfflineChange: (offline) => changes.push(offline),
      now,
      sleep,
      timeoutMs: 9_000,
    });
    expect(outcome).toBe("paid");
    expect(changes).toEqual([true, false]);
  });

  it("times out to a still-confirming state instead of failing", async () => {
    const { now, sleep } = clock();
    const outcome = await pollPaymentUntilSettled({ check: async () => "pending", isOnline: () => true, now, sleep, timeoutMs: 10_000 });
    expect(outcome).toBe("timeout");
  });

  it("keeps polling through a dropped request", async () => {
    const { now, sleep } = clock();
    let calls = 0;
    const outcome = await pollPaymentUntilSettled({
      check: async () => {
        calls += 1;
        if (calls === 1) throw new Error("network");
        return "paid";
      },
      isOnline: () => true,
      now,
      sleep,
    });
    expect(outcome).toBe("paid");
    expect(calls).toBe(2);
  });
});
