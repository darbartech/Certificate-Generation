import Icon from "./Icon";

export type StepperStep = {
  key: string;
  label: string;
};

export default function Stepper({
  steps,
  current,
  completed,
  onSelect,
  disabled,
}: {
  steps: StepperStep[];
  current: number;
  completed: (index: number) => boolean;
  onSelect?: (index: number) => void;
  disabled?: (index: number) => boolean;
}) {
  return (
    <ol className="flex items-center gap-0 overflow-x-auto pb-1" aria-label="Progress">
      {steps.map((step, i) => {
        const isDone = completed(i) && i !== current;
        const isActive = i === current;
        const isDisabled = disabled ? disabled(i) : false;
        const stateClass = isActive
          ? "bg-brand-navy text-white border-brand-navy"
          : isDone
            ? "bg-brand-cyan text-white border-brand-cyan"
            : "bg-white text-gray-400 border-gray-300";
        const labelClass = isActive
          ? "text-brand-navy font-semibold"
          : isDone
            ? "text-brand-cyan"
            : "text-gray-400";
        return (
          <li key={step.key} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onSelect?.(i)}
              disabled={isDisabled}
              aria-current={isActive ? "step" : undefined}
              className="group flex items-center gap-2.5 py-1 disabled:cursor-not-allowed text-left"
            >
              <span
                className={`inline-flex items-center justify-center h-7 w-7 rounded-full border-2 text-xs font-bold transition-colors duration-150 ${stateClass}`}
              >
                {isDone ? <Icon name="check" size={13} /> : i + 1}
              </span>
              <span className={`hidden sm:block text-sm whitespace-nowrap ${labelClass}`}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={`mx-3 h-px w-6 sm:w-10 transition-colors duration-150 ${
                  completed(i) ? "bg-brand-cyan" : "bg-gray-200"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}