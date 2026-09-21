import Image from "next/image";
import Link from "next/link";
import { ThemeSelector } from "@/components/theme-selector";

export function SiteHeader() {
  return <><a className="site-skip" href="#page-content">Skip to content</a><header className="site-header">
    <Link href="/" className="site-wordmark" aria-label="Proper Respect home">
      <span className="site-mark"><Image src="/brand/homepage/PR-mark-black.png" alt="" width={40} height={34} /></span>
      <span>Proper Respect</span>
    </Link>
    <div className="site-theme"><ThemeSelector /></div>
    <nav className="site-navigation" aria-label="Main navigation">
      <Link href="/#how-it-works">How it works</Link>
      <Link href="/#example">Example</Link>
      <Link href="/about/origins">Origins</Link>
      <Link href="/sign-in">Sign in</Link>
      <Link className="site-start" href="/app/collection">Your collection</Link>
    </nav>
  </header></>;
}

const footerGroups = [
  { title: "Product", links: [{ label: "How it works", href: "/#how-it-works" }, { label: "Usage examples", href: "/#example" }, { label: "Your collection", href: "/app/collection" }] },
  { title: "Company", links: [{ label: "Origins", href: "/about/origins" }, { label: "Contact" }, { label: "Social" }] },
  { title: "Resources", links: [{ label: "Help" }, { label: "Privacy" }, { label: "Terms" }] },
];

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-main">
      <div className="site-footer-brand">
        <Link href="/" className="site-wordmark" aria-label="Proper Respect home">
          <span className="site-mark"><Image src="/brand/homepage/PR-mark-black.png" alt="" width={56} height={48} /></span>
          <span>Proper Respect</span>
        </Link>
        <p>Give props.<br />Get props.</p>
      </div>
      <nav className="site-footer-navigation" aria-label="Footer navigation">
        {footerGroups.map(group => <div className="site-footer-group" key={group.title}>
          <h2>{group.title}</h2>
          <ul>{group.links.map(item => <li key={item.label}>
            {"href" in item && item.href ? <Link href={item.href}>{item.label}</Link> : <span className="site-footer-placeholder">{item.label}<small>Coming soon</small></span>}
          </li>)}</ul>
        </div>)}
      </nav>
    </div>
    <div className="site-footer-bottom">
      <span>Proper Respect</span>
      <span>Private by default. Shared by choice.</span>
      <ThemeSelector />
    </div>
  </footer>;
}

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell">
    <section className="auth-intro" aria-labelledby="auth-intro-title">
      <p className="eyebrow">Your collection / Your point of view</p>
      <h1 id="auth-intro-title">Your tools.<br /><span>Your track record.</span></h1>
      <p>Keep what you use, what you are testing, and the context behind your choices. Start in private. Share when you choose.</p>
      <ol className="auth-steps">
        <li>Create your private collection.</li>
        <li>Add a tool and record your experience.</li>
        <li>Connect a source when you want supporting evidence.</li>
        <li>Preview your profile before sharing.</li>
      </ol>
    </section>
    <div className="auth-form">{children}</div>
  </main>;
}
