import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRightIcon, ArrowLeftIcon, PlusIcon, XIcon, CheckIcon, LockIcon, LinkIcon, SyncIcon, SunIcon, MoonIcon, GitCommitIcon, GitPullRequestIcon, RepoIcon, ChevronRightIcon, ShieldCheckIcon, HistoryIcon, MailIcon, FileIcon, PeopleIcon, SearchIcon, CheckCircleFillIcon, AlertIcon } from '@primer/octicons-react';
import { siGithub, siGmail, siNotion } from 'simple-icons';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@primer/primitives/dist/css/base/typography/typography.css';
import '@primer/primitives/dist/css/functional/themes/light.css';
import '@primer/primitives/dist/css/functional/themes/dark.css';
import '@primer/css/dist/box.css';
import '@primer/css/dist/labels.css';
import './styles.css';
import { IntroducerField, IntroducerCredit } from './introducer-field';
import { accountOptions, providers, products, contributions, contributionTotal, AS_OF } from './data';

const icons = { github: siGithub, gmail: siGmail, notion: siNotion };
function Brand({ name, size = 24 }) {
  if (name === 'slack') return null;
  if (!icons[name]) return <MailIcon size={size} />;
  const icon = icons[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={icon.path} /></svg>;
}
function Button({ children, className = '', icon: Icon, ...props }) {
  return <button type="button" className={`button ${className}`} {...props}>{Icon && <Icon size={17} />}{children}</button>;
}
function App() {
  const [variant, setVariant] = useState(new URLSearchParams(location.search).get('view') === 'collection' ? 'collection' : 'studio');
  const [dark, setDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);
  const [accounts, setAccounts] = useState([]);
  const [discoveries, setDiscoveries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [filter, setFilter] = useState('All');
  const [cadence, setCadence] = useState('Manual');
  const [announcement, setAnnouncement] = useState('');
  const [modal, setModal] = useState(null);
  const [consentStage, setConsentStage] = useState('choose');
  const [chosenAccount, setChosenAccount] = useState(null);
  const [connectError, setConnectError] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  const [review, setReview] = useState(null);
  const dialog = useRef(null);
  const lastFocus = useRef(null);
  const pending = useRef(null);
  const results = useRef(null);
  const activeAccounts = accounts.filter(a => a.connected);
  const kept = discoveries.filter(d => d.decision === 'kept');
  const visible = discoveries.filter(d => filter === 'Dismissed' ? d.decision === 'dismissed' : d.decision !== 'dismissed' && (filter === 'All' || (filter === 'To review' ? d.decision === 'pending' : d.status === filter)));
  const unseenAccounts = activeAccounts.some(a => !a.scanned);

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [modal]);
  useEffect(() => () => clearTimeout(pending.current), []);
  function openModal(next) { lastFocus.current = document.activeElement; setModal(next); }
  function closeModal() { setModal(null); setTimeout(() => lastFocus.current?.isConnected && lastFocus.current.focus(), 0); }
  function openConnect(provider) {
    setConsentStage('choose'); setChosenAccount(null); setConnectError(false); setSimulateError(false); openModal({ kind: 'connect', provider });
  }
  function authorize() {
    if (simulateError) { setConnectError(true); return; }
    setAccounts(prev => [...prev.filter(a => a.id !== chosenAccount.id), { ...chosenAccount, connected: true, scanned: false }]);
    setAnnouncement(`Sample ${chosenAccount.email} connected. Find tools to inspect its synthetic discoveries.`);
    closeModal();
  }
  function discover() {
    setBusy(true); setAnnouncement('Reading synthetic account fixtures. Nothing is fetched from a provider.');
    pending.current = setTimeout(() => {
      const hasMail = activeAccounts.some(a => a.provider !== 'github');
      const hasGithub = activeAccounts.some(a => a.provider === 'github');
      const found = products.filter(p => p.id === 'github' ? hasGithub || hasMail : hasMail).map(p => {
        const previous = discoveries.find(d => d.id === p.id);
        const sourceIds = [...new Set([...(previous?.sourceIds || []), ...activeAccounts.filter(a => p.id === 'github' || a.provider !== 'github').map(a => a.id)])];
        return { ...p, decision: 'pending', evidence: p.id === 'github' && hasGithub, captured: AS_OF, ...previous, sourceIds, ...(p.id === 'github' && hasGithub ? { evidence: true, captured: AS_OF } : {}) };
      });
      setDiscoveries(prev => [...prev.filter(p => !found.some(f => f.id === p.id)), ...found]);
      setAccounts(prev => prev.map(a => a.connected ? { ...a, scanned: true } : a));
      setHasScanned(true); setBusy(false); setFilter('All');
      setAnnouncement(`${found.length} sample products found. All discoveries are private and need your review.`);
      setTimeout(() => results.current?.focus(), 0);
    }, 750);
  }
  function openReview(item) { setReview({ ...item }); openModal({ kind: 'review' }); }
  function saveReview(event) {
    event.preventDefault();
    setDiscoveries(prev => prev.map(d => d.id === review.id ? { ...review, decision: 'kept' } : d));
    setAnnouncement(`${review.name} saved to your private collection as ${review.status.toLowerCase()}. Nothing was published.`); closeModal();
  }
  function dismiss(id) { setDiscoveries(prev => prev.map(d => d.id === id ? { ...d, decision: 'dismissed' } : d)); setAnnouncement('Sample discovery set aside. Restore it from Dismissed.'); closeModal(); }
  function disconnect(id) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, connected: false } : a));
    setAnnouncement('Sample account disconnected. Existing private sample records remain; no new activity will arrive from this source.');
  }
  function reset() {
    clearTimeout(pending.current); setBusy(false); setAccounts([]); setDiscoveries([]); setHasScanned(false); setFilter('All'); setCadence('Manual'); setAnnouncement('Demo reset. All synthetic connections and edits cleared.');
  }
  function changeVariant(next) {
    setVariant(next); history.replaceState(null, '', `?view=${next}`); setAnnouncement(`Switched to ${next === 'studio' ? 'Connection studio' : 'Living collection'}. Your demo progress is preserved.`);
  }
  const accountSection = <section className="connections" aria-labelledby="connect-title">
    <div className="section-title"><h2 id="connect-title">Connect your accounts</h2><span className="subtle">{activeAccounts.length} connected</span></div>
    <p className="subtle connection-intro">Personal, work, the side project. There’s room for all of them.</p>
    <div className="provider-list">{Object.keys(providers).map(provider => <button className={`provider ${provider}`} key={provider} onClick={() => openConnect(provider)}><span className="provider-icon"><Brand name={provider} /></span><span><strong>{providers[provider]}</strong><small>{provider === 'github' ? 'Bring in your activity' : 'Find the tools in your inbox'}</small></span><PlusIcon size={19} /></button>)}</div>
    {accounts.length > 0 && <ul className="account-list">{accounts.map(account => <li key={account.id}><span className="account-symbol"><Brand name={account.provider} size={18} /></span><span className="account-name"><strong>{account.email}</strong><small>{account.label} / {account.connected ? 'Simulated connection' : 'Disconnected'}</small></span><button className="icon-button" aria-label={`${account.connected ? 'Disconnect' : 'Reconnect'} ${account.email}`} onClick={() => account.connected ? disconnect(account.id) : openConnect(account.provider)}>{account.connected ? <XIcon /> : <LinkIcon />}</button></li>)}</ul>}
    <div className="connection-action"><Button className="primary" onClick={discover} disabled={!activeAccounts.length || busy} icon={busy ? SyncIcon : SearchIcon}>{busy ? 'Finding sample tools…' : hasScanned ? unseenAccounts ? 'Find tools in new accounts' : 'Refresh sample discoveries' : 'Find my tools'}</Button><p><LockIcon size={13} /> Only you can see what we find.</p></div>
    <details className="permissions"><summary>What are you giving access to?</summary><p>This local demo uses sample accounts only. A production email connector would request read permission separately from your PROPER-RESPECT login. Specific scopes and retention still need provider review.</p><p>You choose which discoveries to keep. Nothing here can read mail, send messages, or publish.</p></details>
  </section>;

  return <div className={`prototype ${variant}`}>
    <a className="skip-link" href="#main">Skip to onboarding</a>
    <div className="demo-bar"><span><span className="demo-label">LOCAL PROTOTYPE</span><span className="demo-detail">Synthetic data only. No live connections.</span></span><nav aria-label="Prototype choice"><button aria-pressed={variant === 'studio'} onClick={() => changeVariant('studio')}>A / Connection studio</button><button aria-pressed={variant === 'collection'} onClick={() => changeVariant('collection')}>B / Living collection</button></nav></div>
    <header className="masthead"><a className="wordmark" href={`?view=${variant}`} aria-label="proper/respect. Restart prototype">proper<span className="brand-divider">/</span>respect<span className="brand-period">.</span></a><div className="header-right"><span className="private-label"><LockIcon size={14} /> Private workspace</span><button className="icon-button" aria-label={dark ? 'Use light theme' : 'Use dark theme'} onClick={() => setDark(!dark)}>{dark ? <SunIcon size={19} /> : <MoonIcon size={19} />}</button><button className="reset" onClick={reset}>Reset demo</button><span className="avatar" aria-label="Morgan, sample user">M</span></div></header>
    <main id="main">
      {variant === 'studio' ? <>
        <nav className="progress" aria-label="Onboarding progress"><span className={hasScanned ? 'complete' : 'current'}>{hasScanned ? <CheckIcon size={15} /> : <span className="step-number">1</span>}Connect accounts</span><span className="progress-line" /><span className={hasScanned && !kept.length ? 'current' : kept.length ? 'complete' : ''}><span className="step-number">2</span>Review your discoveries</span><span className="progress-line" /><span className={kept.length ? 'current' : ''}><span className="step-number">3</span>Make it yours</span></nav>
        <div className="studio-layout"><div className="setup-column"><div className="intro"><h1>Your work moves.<br />Your proof should, too.</h1><p>Bring your accounts together. Find the tools you’ve used, the ones that stuck, and the people who put you on.</p></div>{accountSection}<div className="continuity"><HistoryIcon size={21} /><p><strong>A job changes. Your story carries on.</strong><span>Keep reviewed evidence with your personal account. Workplace access and retention rules still apply.</span></p></div></div><div className="discovery-column"><div className="collection-heading"><div><h2>{hasScanned ? 'Look what’s in your stack.' : 'A little proof goes a long way.'}</h2><p>{hasScanned ? 'A starting point, ready for your say.' : 'This is what your collection could look like.'}</p></div><span className="small-tag">{hasScanned ? 'PRIVATE DRAFTS' : 'EXAMPLE COLLECTION'}</span></div>{renderCollection()}</div></div>
      </> : <>
        <div className="collection-intro"><div><h1>Your tools.<br /><span>Your story to keep.</span></h1><p>The things you tried. The tools you still reach for.<br className="desktop-break" /> Connect a few accounts and start finding your collection.</p></div><div className="collection-count"><span className="count-art">{String(kept.length).padStart(2, '0')}</span><span>tools in your<br />private collection</span></div></div>
        <div className="collection-layout"><aside>{accountSection}<div className="continuity"><ShieldCheckIcon size={21} /><p><strong>You make the call.</strong><span>Discoveries stay private until you review them. A mention isn’t a usage claim.</span></p></div></aside><section className="collection-board"><div className="collection-heading"><h2>{hasScanned ? 'Your discoveries' : 'Your collection starts here'}</h2><span className="small-tag">{hasScanned ? 'PRIVATE DRAFTS' : 'SYNTHETIC EXAMPLES'}</span></div>{renderCollection()}</section></div>
      </>}
      {hasScanned && <section className="finish-bar"><div><CheckCircleFillIcon size={23} /><p><strong>{kept.length ? `${kept.length} ${kept.length === 1 ? 'tool' : 'tools'} saved for you.` : 'You’re in control of the next step.'}</strong><span>{kept.length ? 'Your collection is private. You can revisit every decision.' : 'Keep what belongs, set aside what doesn’t. No bio needed.'}</span></p></div><Button onClick={() => openModal({ kind: 'collection' })} disabled={!kept.length} icon={ArrowRightIcon}>Preview my collection</Button></section>}
    </main>
    <footer><span>PROPER-RESPECT / ONBOARDING STUDIES</span><span>Fixture date: September 16, 2026</span><a href="https://primer.style/product/primitives/" target="_blank" rel="noreferrer">GitHub card uses Primer</a></footer>
    <div className="announcer" role="status" aria-live="polite">{announcement}</div>
    <dialog ref={dialog} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary')].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onCancel={closeModal} onClick={event => { if (event.target === dialog.current) closeModal(); }} onClose={() => { if (modal) closeModal(); }} aria-labelledby="dialog-title">
      {modal && <div className="dialog-content"><button className="dialog-close icon-button" onClick={closeModal} aria-label="Close dialog"><XIcon size={22} /></button>
        {modal.kind === 'connect' && <>
          <div className={`dialog-brand ${modal.provider}`}><Brand name={modal.provider} size={30} /></div>
          <p className="dialog-note">SIMULATED CONNECTION</p>
          <h2 id="dialog-title">{consentStage === 'choose' ? `Add a ${providers[modal.provider]} account` : 'Read access, on your terms.'}</h2>
          {consentStage === 'choose' ? <><p>Choose a sample identity. This doesn’t change your PROPER-RESPECT login.</p><div className="identity-options">{accountOptions[modal.provider].map(account => {
            const exists = accounts.some(a => a.id === account.id && a.connected);
            return <button className="identity-option" key={account.id} disabled={exists} onClick={() => { setChosenAccount(account); setConsentStage('consent'); }}><span className="avatar">{account.label[0]}</span><span><strong>{account.email}</strong><small>{account.label}{exists ? ' / Already connected' : ''}</small></span>{exists ? <CheckIcon /> : <ChevronRightIcon />}</button>;
          })}</div><p className="fine-print">Only reserved example domains and invented usernames are used. No provider will open.</p></> : <><div className="consent-account"><Brand name={modal.provider} size={18} /><strong>{chosenAccount.email}</strong></div><p>In the proposed flow, you would authorize this account separately with {providers[modal.provider]}. This screen only simulates that decision.</p><ul className="scope-list"><li><CheckIcon />{modal.provider === 'github' ? 'Read the selected account’s activity' : 'Read email signals to suggest products'}</li><li><CheckIcon />Create private discoveries for your review</li><li><LockIcon />No send, delete, or publish permission</li></ul><label className="checkbox-label"><input type="checkbox" checked={simulateError} onChange={e => { setSimulateError(e.target.checked); setConnectError(false); }} /> Test a declined permission request</label>{connectError && <p className="error" role="alert">Permission was declined. Nothing connected. Uncheck the test option to retry, or cancel.</p>}<div className="dialog-actions"><Button onClick={() => { setConsentStage('choose'); setConnectError(false); }} icon={ArrowLeftIcon}>Back</Button><Button className="primary" onClick={authorize}>Allow sample read access</Button></div><p className="fine-print">No OAuth token is requested or stored. Production scopes are still a design decision.</p></>}
        </>}
        {modal.kind === 'review' && review && <form onSubmit={saveReview}><div className="review-title"><Brand name={review.id} size={30} /><div><p className="dialog-note">PRIVATE DISCOVERY</p><h2 id="dialog-title">Make {review.name} yours.</h2></div></div><div className="evidence-review"><h3>What supports this?</h3><p>{review.evidence ? `${review.method}. Activity observed ${review.observed}; captured ${review.captured}. Synthetic example only.` : review.hint}</p>{!review.evidence && <Button onClick={() => setReview({ ...review, evidence: true, captured: AS_OF })} icon={PlusIcon}>Add sample activity evidence</Button>}{review.evidence && <p className="fine-print">{review.id === 'slack' ? 'Older evidence. This does not establish current use.' : 'Recent activity in this fixture. Your relationship is still your decision.'}</p>}<details><summary>See source accounts</summary><ul>{review.sourceIds.map(id => { const a = accounts.find(a => a.id === id); return <li key={id}>{a?.email} {a?.connected ? '(sample connection)' : '(disconnected; retained sample)'}</li>; })}</ul></details></div><label className="field">My relationship<select value={review.status} onChange={e => setReview({ ...review, status: e.target.value })}><option>Active</option><option>Tried</option><option>Archived</option></select><small>Your own statement. We don’t infer it from a signup or payment.</small></label><IntroducerField value={review.introducer} platform={review.introducerPlatform} onChange={patch => setReview({ ...review, ...patch })} /><label className="field">Affiliate destination <span className="optional">Optional</span><input type="url" value={review.affiliate} onChange={e => setReview({ ...review, affiliate: e.target.value })} placeholder="https://example.com/your-referral" pattern="https?://.*" /><small>Kept separate from introducer credit and the product link.</small></label><p className="product-destination">Product link <a href={review.url} target="_blank" rel="noreferrer">{review.url}</a></p><div className="dialog-actions"><Button onClick={() => dismiss(review.id)}>Set aside</Button><Button className="primary" type="submit" icon={CheckIcon}>Keep in my private collection</Button></div></form>}
        {modal.kind === 'collection' && <><p className="dialog-note">PRIVATE PREVIEW</p><h2 id="dialog-title">A collection that’s yours.</h2><p>Only the sample tools you chose to keep. Nothing here is published.</p><div className="saved-tools">{kept.map(p => <article key={p.id}><Brand name={p.id} /><div><h3>{p.name} <span className="small-tag">{p.status}</span></h3><IntroducerCredit value={p.introducer} platform={p.introducerPlatform} /><p>{p.evidence ? `Sample activity observed ${p.observed}` : 'Usage unconfirmed; owner-curated relationship'}</p><a href={p.url} target="_blank" rel="noreferrer">Product website</a>{p.affiliate && <span className="affiliate-output">Affiliate destination: {p.affiliate}</span>}<small className="fine-print">Affiliate destinations are displayed as text in this demo.</small></div></article>)}</div><Button className="primary" onClick={closeModal}>Back to my discoveries</Button></>}
      </div>}
    </dialog>
  </div>;

  function renderCollection() {
    return <div ref={results} tabIndex={-1} className="results" aria-label="Product discoveries">
      {busy ? <div className="loading-state" aria-busy="true"><SearchIcon size={28} /><h3>Finding the familiar.</h3><p>Matching the sample accounts to synthetic tools…</p><div className="skeleton" /><div className="skeleton short" /></div> : <>
        {hasScanned && <div className="review-toolbar"><div className="filters" aria-label="Filter discoveries">{['All', 'To review', 'Active', 'Tried', 'Archived', 'Dismissed'].map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div><span className="subtle">{visible.length} {visible.length === 1 ? 'tool' : 'tools'}</span></div>}
        <div className="product-grid">{(hasScanned ? visible : products.slice(0, variant === 'studio' ? 2 : 3).map(p => ({ ...p, evidence: true, captured: AS_OF, preview: true }))).map(p => <div className={`prop-wrapper ${p.id}`} key={p.id}><ProductCard product={p} dark={dark} /><div className="prop-footer">{p.preview ? <><span><LockIcon size={13} /> Synthetic example</span><span>{p.status}</span></> : <><span className={p.decision === 'kept' ? 'saved-state' : ''}>{p.decision === 'kept' ? <CheckIcon size={14} /> : <LockIcon size={13} />}{p.decision === 'kept' ? `${p.status} / Kept privately` : p.decision === 'dismissed' ? 'Set aside' : 'Only you / To review'}</span>{p.decision === 'dismissed' ? <button onClick={() => { setDiscoveries(prev => prev.map(d => d.id === p.id ? { ...d, decision: 'pending' } : d)); setAnnouncement(`${p.name} restored for review.`); }}>Restore</button> : <button aria-label={`${p.decision === 'kept' ? 'Edit' : 'Review'} ${p.name}`} onClick={() => openReview(p)}>{p.decision === 'kept' ? 'Edit' : 'Review'}<ArrowRightIcon size={15} /></button>}</>}</div>{!p.preview && p.sourceIds.every(id => !accounts.find(a => a.id === id)?.connected) && <p className="disconnected-note">Source disconnected. Retained sample; no future refresh.</p>}</div>)}</div>
        {hasScanned && !visible.length && <div className="empty-state"><SearchIcon size={28} /><h3>No tools in this view.</h3><p>Try another filter, or add an account to find more.</p><Button onClick={() => setFilter('All')}>Show all discoveries</Button></div>}
        {hasScanned ? <div className="cadence"><div><h3>Keep the evidence current.</h3><p>Observed activity and capture date stay separate.</p></div><label>Refresh preference<select value={cadence} onChange={e => setCadence(e.target.value)}><option>Manual</option><option>Daily API (proposal)</option><option>Weekly snapshot (proposal)</option></select></label><p className="fine-print">{cadence === 'Manual' ? 'Refresh only when you ask. This demo reads local fixtures.' : `${cadence} is a design proposal. No refresh is scheduled.`}</p></div> : <div className="preview-note"><ShieldCheckIcon size={19} /><p>Connect an account to find your starting point.<span>Invitations and receipts suggest a tool. Activity supports a usage claim.</span></p></div>}
      </>}
    </div>;
  }
}
function ProductCard({ product: p, dark }) {
  return <article className={`vendor-card ${p.id}-card ${p.id === 'github' ? 'Box' : ''}`} data-color-mode={p.id === 'github' ? dark ? 'dark' : 'light' : undefined} data-light-theme="light" data-dark-theme="dark" aria-label={`${p.name} ${p.preview ? 'synthetic example' : 'private discovery'}`}>
    <div className={`vendor-header ${p.id === 'github' ? 'Box-header' : ''}`}><div><Brand name={p.id} size={25} /><h3>{p.name}</h3></div><span>{p.evidence ? p.id === 'slack' ? 'Older evidence' : 'Recent activity' : 'Usage unconfirmed'}</span></div>
    {!p.evidence ? <div className="hint-body"><MailIcon size={27} /><h4>{p.id === 'github' ? 'A familiar notification.' : p.id === 'notion' ? 'An invitation to build.' : 'A subscription in the mix.'}</h4><p>{p.hint}</p><span>Sample email discovery / Needs your review</span></div> : p.id === 'github' ? <div className="github-body Box-body"><div className="gh-account"><span>morgan-sample <span className="Label">Sample</span></span><span>Overview</span></div><p className="gh-chart-title"><strong>{contributionTotal} contributions</strong> in the sample period</p><div className="contribution-months" aria-hidden="true"><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div><div className="contribution-chart" role="img" aria-label={`${contributionTotal} synthetic contributions from March 18 through September 15, 2026. Daily values available below.`}>{contributions.map((value, index) => <span key={index} style={{ background: `var(--contribution-default-bgColor-${Math.min(value, 4)})` }} title={`${value} sample contributions on ${new Date(Date.UTC(2026, 2, 18 + index)).toISOString().slice(0, 10)}`} />)}</div><div className="chart-legend"><span>Activity, not a signup</span><span>Less {[0, 1, 2, 3, 4].map(n => <i key={n} style={{ background: `var(--contribution-default-bgColor-${n})` }} />)} More</span></div><div className="gh-events"><p><GitCommitIcon /><span>Created <strong>{contributionTotal - 9} commits</strong> across 3 repositories</span></p><p><GitPullRequestIcon /><span>Opened <strong>9 pull requests</strong></span></p><p><RepoIcon /><span className="repository">morgan-sample / weekend-build</span><span className="Label">Public</span></p></div><details className="daily-data"><summary>View daily sample counts</summary><div className="daily-table"><table><caption>Synthetic GitHub contributions</caption><thead><tr><th>Date</th><th>Count</th></tr></thead><tbody>{contributions.map((v, i) => <tr key={i}><td>{new Date(Date.UTC(2026, 2, 18 + i)).toISOString().slice(0, 10)}</td><td>{v}</td></tr>)}</tbody></table></div></details></div> : p.id === 'notion' ? <div className="notion-body"><div className="notion-breadcrumb">Morgan’s workspace <ChevronRightIcon size={12} /> Recently edited</div><h4>A few ideas in motion.</h4><div className="notion-pages"><p><FileIcon size={18} /><span>Notes from the field<small>Edited Sep 12</small></span><span className="notion-category">Notes</span></p><p><FileIcon size={18} /><span>Weekend build log<small>Edited Sep 10</small></span><span className="notion-category">Projects</span></p><p><FileIcon size={18} /><span>A reading list that grew<small>Edited Sep 8</small></span><span className="notion-category">Personal</span></p></div><span className="vendor-caption">3 sample page edits / Owner-provided snapshot</span></div> : <div className="slack-body"><div className="slack-workspace"><PeopleIcon size={20} /><strong>Former studio</strong><span>Sample workspace</span></div><h4>Good work happens together.</h4><div className="slack-channels"><span># project-room</span><span># things-we-tried</span></div><p>Activity preserved in an older owner snapshot.<br />The work moved on. The record stayed.</p><span className="vendor-caption">Last observed Aug 10 / Current use unconfirmed</span></div>}
    <div className="evidence-strip"><HistoryIcon size={13} /><span>{p.evidence ? `Observed ${p.observed} / Captured ${p.captured}` : `Found ${p.captured} / Usage not established`}</span></div>
  </article>;
}

createRoot(document.getElementById('root')).render(<App />);
