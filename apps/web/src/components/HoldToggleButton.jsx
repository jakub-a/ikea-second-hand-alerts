import React, { useMemo, useState } from 'react';

function createHoldHandler({ onComplete }) {
  let timer = null;
  let start = 0;
  const duration = 800;

  const startHold = (setProgress) => {
    start = Date.now();
    timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(next);
      if (next >= 100) {
        clearInterval(timer);
        timer = null;
        onComplete();
      }
    }, 16);
  };

  const stopHold = (setProgress) => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    setProgress(0);
  };

  return { startHold, stopHold };
}

export function HoldToggleButton({ active, onToggle }) {
  const [progress, setProgress] = useState(0);
  const { startHold, stopHold } = useMemo(
    () => createHoldHandler({ onComplete: onToggle }),
    [onToggle]
  );

  const label = active ? 'Deactivate' : 'Activate';
  return (
    <button
      type="button"
      className={`hold-button ${active ? 'hold-active' : ''}`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.stopPropagation();
        startHold(setProgress);
      }}
      onMouseUp={(event) => {
        event.stopPropagation();
        stopHold(setProgress);
      }}
      onMouseLeave={() => stopHold(setProgress)}
      onTouchStart={(event) => {
        event.stopPropagation();
        startHold(setProgress);
      }}
      onTouchEnd={(event) => {
        event.stopPropagation();
        stopHold(setProgress);
      }}
      onTouchCancel={() => stopHold(setProgress)}
    >
      <span className="hold-fill" style={{ width: `${progress}%` }} />
      <span className="hold-label">{label}</span>
    </button>
  );
}
