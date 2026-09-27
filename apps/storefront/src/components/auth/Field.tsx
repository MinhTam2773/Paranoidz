import type { InputHTMLAttributes } from "react";
import { errorClass, inputClass, labelClass } from "./styles";

// Label + input + error line. `id` doubles as the FormData name.
export function Field({ id, label, error, ...input }: { id: string; label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input
        id={id}
        name={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${error ? "border-accent" : "border-border"}`}
        {...input}
      />
      {error && <p id={`${id}-error`} className={errorClass}>{error}</p>}
    </div>
  );
}
