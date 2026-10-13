"use client";

export type RetainedAggregateSelection = {
  display: "public" | "private";
  distinction?: "personal" | "former-employer";
};

/** Owner selections only. An address, or any other string, is not a distinction. */
export function retainedAggregateChoice(input: {
  display: string;
  distinction: string;
}): RetainedAggregateSelection | null {
  if (input.display !== "public" && input.display !== "private") return null;
  if (input.distinction === "personal" || input.distinction === "former-employer") {
    return { display: input.display, distinction: input.distinction };
  }
  return { display: input.display };
}

export function RetainedAggregateChoice({
  display,
  distinction,
  disabled,
  onSave,
}: {
  /** Accepted and ignored so a mailbox address cannot become a label. */
  address?: string;
  display?: "public" | "private";
  distinction?: "personal" | "former-employer";
  disabled: boolean;
  onSave: (choice: RetainedAggregateSelection) => void;
}) {
  return (
    <form onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const choice = retainedAggregateChoice({
        display: String(data.get("display") ?? ""),
        distinction: String(data.get("distinction") ?? ""),
      });
      if (choice) onSave(choice);
    }}>
      <fieldset>
        <legend>Retained aggregate</legend>
        <p>Choose whether this mailbox&apos;s retained count appears on your public profile. Record personal or former employer only when you want that label.</p>
        <label>
          <input type="radio" name="display" value="private" defaultChecked={display !== "public"} />
          Private
        </label>
        <label>
          <input type="radio" name="display" value="public" defaultChecked={display === "public"} />
          Public
        </label>
        <label>
          Label
          <select name="distinction" defaultValue={distinction ?? ""}>
            <option value="">Not recorded</option>
            <option value="personal">Personal</option>
            <option value="former-employer">Former employer</option>
          </select>
        </label>
        <button className="secondary-action" type="submit" disabled={disabled}>Save retained aggregate</button>
      </fieldset>
    </form>
  );
}
