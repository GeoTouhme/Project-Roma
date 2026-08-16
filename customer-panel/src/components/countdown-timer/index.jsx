import React, { useEffect, useState } from "react";

const CountdownTimer = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) return <span className="text-red-600 font-bold">Sale ended</span>;

  return (
    <div className="flex gap-2 text-sm font-bold text-red-600">
      <span>{String(timeLeft.h).padStart(2, "0")}h</span>
      <span>{String(timeLeft.m).padStart(2, "0")}m</span>
      <span>{String(timeLeft.s).padStart(2, "0")}s</span>
    </div>
  );
};

function getTimeLeft(targetDate) {
  const diff = new Date(targetDate) - new Date();
  if (diff <= 0) return null;
  return {
    h: Math.floor((diff / (1000 * 60 * 60)) % 24),
    m: Math.floor((diff / (1000 * 60)) % 60),
    s: Math.floor((diff / 1000) % 60),
  };
}

export default CountdownTimer;
