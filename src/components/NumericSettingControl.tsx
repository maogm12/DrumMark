import { useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stepPrecision(step: number) {
  const stepText = step.toString();
  const decimal = stepText.indexOf(".");
  return decimal >= 0 ? stepText.length - decimal - 1 : 0;
}

function normalizeSteppedValue(value: number, min: number, max: number, step: number) {
  const precision = stepPrecision(step);
  const clamped = clampNumber(value, min, max);
  return Number(clamped.toFixed(precision));
}

export function NumericSettingControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const inputMode = stepPrecision(step) > 0 ? "decimal" : "numeric";
  const rangeRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyValue = (next: number) => {
    onChange(normalizeSteppedValue(next, min, max, step));
  };

  const handleRangePointerDown = (event: ReactPointerEvent<HTMLInputElement>) => {
    const input = rangeRef.current;
    if (!input) return;

    event.preventDefault();
    const startX = event.clientX;
    const startValue = value;
    input.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rect = input.getBoundingClientRect();
      if (rect.width <= 0) return;

      const deltaRatio = (moveEvent.clientX - startX) / rect.width;
      const rawValue = startValue + deltaRatio * (max - min);
      const steppedValue = min + Math.round((rawValue - min) / step) * step;
      applyValue(steppedValue);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      input.removeEventListener("pointermove", handlePointerMove);
      input.removeEventListener("pointerup", handlePointerUp);
      input.removeEventListener("pointercancel", handlePointerUp);
    };

    setIsDragging(true);
    input.addEventListener("pointermove", handlePointerMove);
    input.addEventListener("pointerup", handlePointerUp);
    input.addEventListener("pointercancel", handlePointerUp);
  };

  const handleRangeWheel = (event: ReactWheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    applyValue(value + direction * step);
  };

  return (
    <div className="setting-row numeric-setting-row">
      <div className="setting-label">
        <span>{label}</span>
      </div>
      <input
        ref={rangeRef}
        className={isDragging ? "setting-range is-dragging" : "setting-range"}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => applyValue(parseFloat(e.target.value))}
        onPointerDown={handleRangePointerDown}
        onWheel={handleRangeWheel}
      />
      <div className="setting-stepper">
        <button
          className="setting-stepper-button"
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => applyValue(value - step)}
        >
          -
        </button>
        <input
          className="setting-stepper-input"
          type="number"
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const next = parseFloat(e.target.value);
            if (!Number.isNaN(next)) {
              applyValue(next);
            }
          }}
        />
        <button
          className="setting-stepper-button"
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => applyValue(value + step)}
        >
          +
        </button>
      </div>
    </div>
  );
}
