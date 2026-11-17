"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/src/domain/user-error";

export const searchListingLabel = "List my page in search";
export const searchListingDescription = "People can find your page by your name and handle, and on the page of each tool you share. Your page stays public at its link either way. This saves at once, and you can change it here any time.";

export function SearchListingChoiceView({ listed, saving, error, onChange }: {
  listed: boolean; saving: boolean; error: string; onChange: (listed: boolean) => void;
}) {
  return <Field className="search-listing-choice">
    <div>
      <FieldLabel>{searchListingLabel}</FieldLabel>
      <FieldDescription>{searchListingDescription}</FieldDescription>
    </div>
    <Switch checked={listed} aria-busy={saving} onCheckedChange={(next, details) => {
      details.cancel();
      if (!saving) onChange(next);
    }}>
      <SwitchThumb />
    </Switch>
    {error && <p role="alert" className="search-listing-error">{error}</p>}
  </Field>;
}

export function SearchListingChoice() {
  const choice = useQuery(api.publicProfiles.searchListingChoice, {});
  const setSearchListing = useMutation(api.publicProfiles.setSearchListing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!choice) return null;
  return <SearchListingChoiceView listed={choice.listed} saving={saving} error={error} onChange={async listed => {
    setSaving(true);
    setError("");
    try {
      await setSearchListing({ listed });
    } catch (reason) {
      setError(errorMessage(reason, "Your search listing could not be saved. It is unchanged; try again."));
    } finally {
      setSaving(false);
    }
  }} />;
}
