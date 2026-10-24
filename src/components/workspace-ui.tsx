import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#4457ff]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:text-[30px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#757693]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "bg-[#eef0ff] text-[#4457ff]",
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  tone?: string;
}) {
  return (
    <article className="rounded-3xl border border-[#e5e7eb] bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd0ff]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#757693]">{label}</p>
          <p className="mt-2 break-words text-2xl font-bold tracking-[-0.04em] tabular-nums">{value}</p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon name={icon} size={19} />
        </span>
      </div>
      <p className="mt-3 border-t border-[#f0f0f5] pt-3 text-[11px] text-[#757693]">{detail}</p>
    </article>
  );
}

export function PillTabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-[#eef0fa] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-10 rounded-full px-4 text-xs font-semibold transition duration-150 ${
            value === option.value ? "bg-white text-[#4457ff] shadow-sm" : "text-[#757693] hover:text-[#181c31]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  value,
  onChange,
  children,
  className = "",
  defaultValue,
  id,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string | number;
  onChange?: (value: string) => void;
  children?: ReactNode;
  className?: string;
  defaultValue?: string;
  id?: string;
}) {
  const inputClass =
    "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-[#181c31] outline-none transition placeholder:text-[#a2a3b7] focus:border-[#4457ff] focus:ring-2 focus:ring-[#4457ff]/10";
  return (
    <label className={`block text-xs font-semibold text-[#55566f] ${className}`}>
      {label}
      {children ? (
        <select
          id={id}
          name={name}
          required={required}
          {...(value !== undefined ? { value } : { defaultValue })}
          onChange={(event) => onChange?.(event.target.value)}
          className={inputClass}
        >
          {children}
        </select>
      ) : (
        <input
          id={id}
          className={inputClass}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          {...(value !== undefined ? { value } : { defaultValue })}
          onChange={(event) => onChange?.(event.target.value)}
        />
      )}
    </label>
  );
}

export function PrimaryButton({
  children,
  type = "button",
  onClick,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#4457ff] to-[#7583fd] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(68,87,255,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(68,87,255,0.25)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-[10px] font-semibold ${tone}`}>
      {label}
    </span>
  );
}

export function TableFrame({
  title,
  description,
  children,
  toolbar,
}: {
  title: string;
  description: string;
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white">
      <div className="flex flex-col justify-between gap-3 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="mt-1 text-xs text-[#757693]">{description}</p>
        </div>
        {toolbar}
      </div>
      {children}
    </section>
  );
}

export function FormMessage({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return (
    <p role="status" className={`rounded-2xl px-4 py-3 text-xs leading-5 ${success ? "bg-[#e8f5f0] text-[#25815e]" : "bg-[#fff4e7] text-[#9a5b16]"}`}>
      {children}
    </p>
  );
}
