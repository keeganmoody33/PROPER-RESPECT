import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return <><a className="site-skip" href="#page-content">Skip to content</a><header className="site-header">
    <Link href="/" className="site-wordmark" aria-label="Proper Respect home">
      <Image src="/brand/homepage/PR-mark-black.png" alt="" width={40} height={34} />
      <span>Proper Respect</span>
    </Link>
    <nav className="site-navigation" aria-label="Main navigation">
      <Link href="/#how-it-works">How it works</Link>
      <Link href="/#example">Example</Link>
      <Link href="/sign-in">Sign in</Link>
      <Link className="site-start" href="/collection">Your collection</Link>
    </nav>
  </header></>;
}

export function SiteFooter() {
  return <footer className="site-footer">
    <span>Proper Respect / Give props. Get props.</span>
    <span>Private by default. Shared by choice.</span>
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
