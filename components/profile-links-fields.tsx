"use client";

import { useState } from "react";
import { PROFILE_LINK_LIMIT } from "@/src/domain/profile-links";

type Link = { label: string; url: string };
export function ProfileLinksFields({ links = [], preferredLinkUrl }: { links?: Link[]; preferredLinkUrl?: string }) {
  const [rows, setRows] = useState<Link[]>(links);
  const [preferred, setPreferred] = useState(links.findIndex(link => link.url === preferredLinkUrl));
  function update(index: number, key: keyof Link, value: string) {
    setRows(current => current.map((link, i) => i === index ? { ...link, [key]: value } : link));
  }
  return <fieldset className="full profile-links-fields">
    <legend>Social and website links</legend>
    <p>Choose which link opens when someone clicks your name. Saved changes stay private until you approve a fresh sharing preview.</p>
    <label className="profile-link-choice"><input type="radio" name="preferredProfileLink" value="" checked={preferred === -1} onChange={() => setPreferred(-1)} />Keep my name as text</label>
    {rows.map((link, index) => <div className="form-grid" key={index}>
      <label>Link {index + 1} label<input name="profileLinkLabel" value={link.label} onChange={event => update(index, "label", event.target.value)} maxLength={60} required /></label>
      <label>Link {index + 1} URL<input name="profileLinkUrl" type="url" value={link.url} onChange={event => update(index, "url", event.target.value)} maxLength={2048} placeholder="https://" required /></label>
      <label className="profile-link-choice"><input type="radio" name="preferredProfileLink" value={index} checked={preferred === index} onChange={() => setPreferred(index)} />Use for my name</label>
      <button type="button" className="secondary-action" onClick={() => { setRows(current => current.filter((_, i) => i !== index)); setPreferred(current => current === index ? -1 : current > index ? current - 1 : current); }}>Remove link {index + 1}</button>
    </div>)}
    {rows.length < PROFILE_LINK_LIMIT && <button type="button" className="secondary-action" onClick={() => setRows(current => [...current, { label: "", url: "" }])}>Add a profile link</button>}
  </fieldset>;
}
