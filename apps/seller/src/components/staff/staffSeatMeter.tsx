import styles from "./staff.module.css";

export function StaffSeatMeter({ seatsInUse, maximumSeats }: { readonly seatsInUse: number; readonly maximumSeats: number }) {
  const fillPercent = maximumSeats === 0 ? 100 : Math.min(100, Math.round((seatsInUse / maximumSeats) * 100));
  const isFull = seatsInUse >= maximumSeats;
  return (
    <div className={styles.seatMeter}>
      <span className={styles.seatLabel}>
        {seatsInUse} of {maximumSeats} team seats in use · the owner is not counted
      </span>
      <div className={styles.seatTrack} role="meter" aria-label="Team seats in use" aria-valuemin={0} aria-valuemax={maximumSeats} aria-valuenow={seatsInUse}>
        <div className={`${styles.seatFill} ${isFull ? styles.seatFillFull : ""}`} style={{ width: `${fillPercent}%` }} />
      </div>
    </div>
  );
}
