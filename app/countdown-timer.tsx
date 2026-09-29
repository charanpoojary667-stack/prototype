"use client";

import { useEffect, useState } from "react";

const second = 1000;
const minute = 60;
const hour = 60 * minute;
const day = 24 * hour;

type Countdown = { days: number; hours: number; minutes: number; seconds: number };

function getCountdown(targetTime: number, currentTime: number): Countdown {
  const totalSeconds = Math.max(0, Math.floor((targetTime - currentTime) / second));
  return {
    days: Math.floor(totalSeconds / day),
    hours: Math.floor((totalSeconds % day) / hour),
    minutes: Math.floor((totalSeconds % hour) / minute),
    seconds: totalSeconds % minute,
  };
}

function format(value: number) {
  return String(value).padStart(2, "0");
}

export default function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [countdown, setCountdown] = useState<Countdown>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetTime = new Date(targetDate).getTime();
    const updateCountdown = () => {
      setCountdown(getCountdown(Number.isFinite(targetTime) ? targetTime : 0, Date.now()));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, second);
    return () => window.clearInterval(intervalId);
  }, [targetDate]);

  const label = `${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, and ${countdown.seconds} seconds until kickoff`;

  return (
    <div className="event-countdown" aria-label={label}>
      <p>COUNTDOWN TO KICKOFF</p>
      <div className="countdown-units countdown-units--four" aria-live="off">
        <div><strong key={countdown.days}>{format(countdown.days)}</strong><span>DAYS</span></div>
        <i>:</i>
        <div><strong key={countdown.hours}>{format(countdown.hours)}</strong><span>HRS</span></div>
        <i>:</i>
        <div><strong key={countdown.minutes}>{format(countdown.minutes)}</strong><span>MIN</span></div>
        <i>:</i>
        <div><strong key={countdown.seconds}>{format(countdown.seconds)}</strong><span>SEC</span></div>
      </div>
      <span className="countdown-note"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> Registration closes soon</span>
    </div>
  );
}