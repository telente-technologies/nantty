import styles from "./staff.module.css";

export function StaffSeatMeter({ seatsInUse, maximumSeats }: { readonly seatsInUse: number; readonly maximumSeats: number | null }) {
  if (maximumSeats === null) return <p className={styles.seatLabel}>{seatsInUse} seats in use · unlimited on your plan</p>;
  const fillPercent = maximumSeats === 0 ? 100 : Math.min(100, Math.round((seatsInUse / maximumSeats) * 100));
  const isFull = seatsInUse >= maximumSeats;
  return (
    <div className={styles.seatMeter}>
      <span className={styles.seatLabel}>
        {seatsInUse} of {maximumSeats} seats in use
      </span>
      <div className={styles.seatTrack} role="meter" aria-label="Staff seats in use" aria-valuemin={0} aria-valuemax={maximumSeats} aria-valuenow={seatsInUse}>
        <div className={`${styles.seatFill} ${isFull ? styles.seatFillFull : ""}`} style={{ width: `${fillPercent}%` }} />
      </div>
    </div>
  );
}
