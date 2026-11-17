"use client";

import { isYearOnly } from "@/src/domain/start-date";

/**
 * A date field that also holds a start date saved as just a year ("2023"). A date input can't show a year alone, so
 * the year is kept as it is, says so, and travels in the form under the field's name until a full date replaces it.
 */
export function StartDateInput({ value, onChange, name, className, ...input }: {
  value: string; onChange: (value: string) => void; name?: string; className?: string;
  "aria-label"?: string; "aria-describedby"?: string; disabled?: boolean; readOnly?: boolean;
}) {
  const year = isYearOnly(value);
  return <>
    <input {...input} className={className} type="date" name={year ? undefined : name} value={year ? "" : value}
      onChange={event => onChange(event.target.value)} />
    {year && <>
      {name && <input type="hidden" name={name} value={value} />}
      <span>Saved as just the year, {value}. Pick a full date to replace it.</span>
      {!input.disabled && !input.readOnly && <button type="button" className="secondary-action" onClick={() => onChange("")}>Clear the year</button>}
    </>}
  </>;
}
