import React from 'react';
import { LinkIcon } from '@primer/octicons-react';
import { interpretIntroducer, creditPlatform, platforms } from './introducer';

export function IntroducerField({ value, platform, onChange }) {
  const detected = interpretIntroducer(value);
  const showContext = detected.kind === 'handle' || detected.kind === 'link' || Boolean(platform);
  const platformControl = <label className="field platform-field">Platform <span className="optional">Optional</span>
    <select value={platform || ''} onChange={e => onChange({ introducerPlatform: e.target.value })}>
      <option value="">{detected.platform ? `${detected.platform} (suggested from link)` : 'Not specified'}</option>
      {detected.platform && <option value="unspecified">Not specified</option>}
      {platforms.map(name => <option key={name}>{name}</option>)}
    </select>
    <small>{detected.kind === 'handle' ? 'The same handle can belong to different people on different platforms. You can leave this open.' : 'A platform gives context. It doesn’t verify who introduced you.'}</small>
  </label>;
  return <div className="introducer-field">
    <label className="field" htmlFor="introducer">Who put you on? <span className="optional">Optional</span></label>
    <input id="introducer" aria-describedby="introducer-help" value={value} onChange={e => onChange({ introducer: e.target.value, introducerPlatform: '' })} placeholder="@handle, example.com, a link, or a name" autoComplete="off" spellCheck={false} />
    <p id="introducer-help">Paste what you have, or leave it blank. This credit is self-attested.</p>
    {detected.kind === 'link' && <div className="introducer-detected" role="status"><LinkIcon size={15} /><span><strong>{detected.host}</strong><small>{creditPlatform(value, platform) || 'Platform not specified'} / Link recognized, identity unverified</small></span></div>}
    {showContext ? platformControl : value.trim() ? <details className="introducer-context"><summary>Add a platform, if you know it</summary>{platformControl}</details> : null}
  </div>;
}

export function IntroducerCredit({ value, platform }) {
  const detected = interpretIntroducer(value);
  const selected = creditPlatform(value, platform);
  return <div className="saved-credit"><p className="credit-raw">{value.trim() ? `Put on by ${value}` : 'Introducer not added'}<small>{selected ? `${selected} / ` : ''}Self-attested credit</small></p>
    {detected.url && <a href={detected.url} target="_blank" rel="noopener noreferrer">Introducer link</a>}
  </div>;
}
