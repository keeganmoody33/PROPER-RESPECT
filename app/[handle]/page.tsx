import { auth } from "@clerk/nextjs/server";
import { PublicProfileWebMcp } from "@/components/public-profile-webmcp";
import { ProfileLinkProps } from "@/components/profile-link-props";
import { projectVisiblePublicProfile } from "@/src/domain/visible-public-profile";
import { ProfileName, ProfileLinks } from "@/components/profile-identity";
import { RetainedMailboxAggregate } from "@/components/retained-mailbox-aggregate";
import { convexAuthToken } from "@/src/domain/convex-auth-token";
import { getLinkProps } from "@/src/data/get-link-props";
import type { LinkPropCredit } from "@/src/domain/link-prop";
import type { Metadata } from "next";
import { giveStoredLinkProp } from "./give-link-prop";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { getPublicMailboxAggregate } from "@/src/data/get-public-mailbox-aggregate";
import { getPublicProfile } from "@/src/data/get-public-profile";
import { publicPageMetadata } from "@/src/server/public-site";
import styles from "./profile.module.css";

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

async function signedInViewer() {
  try {
    const session = await auth();
    if (!session.userId) return null;
    const token = await convexAuthToken(session);
    return token ? { token } : null;
  } catch {
    return null;
  }
}

async function propsForViewer(handle: string, token: string | undefined): Promise<LinkPropCredit[]> {
  if (!token) return [];
  try {
    return await getLinkProps(handle, token);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  try {
    const profile = await getPublicProfile(handle);
    if (!profile) return { title: "Profile not found", robots: { index: false, follow: false } };
    return publicPageMetadata(profile.displayName, profile.bio, profile.handle);
  } catch {
    return { title: "Public profile", robots: { index: false, follow: false } };
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle: rawHandle } = await params;

  // An invalid handle or an unpublished profile is absent (404). A malformed
  // payload or an unavailable backend throws to ./error.tsx instead.
  const profile = await getPublicProfile(rawHandle);

  if (!profile) notFound();
  if (profile.handle !== rawHandle) permanentRedirect(`/${profile.handle}`);
  const retainedSources = await getPublicMailboxAggregate(profile.handle);
  const viewer = await signedInViewer();
  const viewerSignedIn = viewer !== null;
  const linkProps = await propsForViewer(profile.handle, viewer?.token);

  // No app/[handle]/loading.tsx and no in-page Suspense here: either one
  // around this await would stream HTTP 200 before notFound() can set 404.
  // ProfileLoading is the inventory/collection/profile-loading fallback.
  return (
    <main>
      <PublicProfileWebMcp profile={projectVisiblePublicProfile(profile)} />
      <div className="profile-context"><p>@{profile.handle} / SHARED PRODUCT COLLECTION</p></div>

      <section className="stack" aria-labelledby="stack-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">@{profile.handle} / TOOLS WITH A TRACK RECORD</p>
            <h1 id="stack-heading" className={styles.name}><ProfileName profile={profile} /></h1>
            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
            <ProfileLinks profile={profile} />
          </div>
          <p>{profile.cards.length.toString().padStart(2, "0")} PRODUCTS</p>
        </div>

        {profile.cards.length === 0 ? (
          <div className="empty-state">
            <h3>No published products yet.</h3>
            <p>Draft and private records stay off this page.</p>
          </div>
        ) : (
          <div className="card-grid">
            {profile.cards.map((card, index) => (
              <ProductCard
                key={`${card.product.slug}-${index}`}
                card={card}
                index={index}
                goTo={card.goTo}
                viewerSignedIn={viewerSignedIn}
                profileHandle={profile.handle}
                onGiveProps={viewerSignedIn ? giveStoredLinkProp : undefined}
              />
            ))}
          </div>
        )}
        <ProfileLinkProps credits={linkProps} viewerSignedIn={viewerSignedIn} />
      </section>

      <RetainedMailboxAggregate sources={retainedSources} />

      <footer className="profile-footer">
        <div>
          <span>@{profile.handle}</span>
        </div>
        <a href={`mailto:33@lecturesfrom.com?subject=${encodeURIComponent(`Report proper-respect.com/${profile.handle}`)}`}>
          Report this page
        </a>
        <Link href="/app/collection">Open your private collection →</Link>
      </footer>
    </main>
  );
}
