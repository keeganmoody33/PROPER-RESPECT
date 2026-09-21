import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return <><a className="site-skip" href="#page-content">Skip to content</a><header className="site-header">
    <Link href="/" className="site-wordmark" aria-label="Proper Respect home">
      <Image src="/brand/homepage/PR-mark-black.png" alt="" width={40} height={34} />
      <span>Proper Respect</span>
    </Link>
    <Link className="site-navigation" href="/onboarding">Your collection</Link>
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
      <figure>
        <Image src="/brand/homepage/fists-blueprint.png" alt="Blueprint illustration of two hands meeting in a fist bump" width={2048} height={1152} sizes="(max-width: 900px) 100vw, 50vw" />
        <figcaption>The handoff / Give props. Get props.</figcaption>
      </figure>
    </section>
    <div className="auth-form">{children}</div>
  </main>;
}
