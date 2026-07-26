import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { ProductCard } from "@/components/product-card";
import { getPublicProfile } from "@/src/data/get-public-profile";
import { buildPublicProfileMetadata } from "@/src/domain/public-site";
import { getServerEnv } from "@/src/env";

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { NEXT_PUBLIC_SITE_URL } = getServerEnv();
  const { handle } = await params;
  try {
    const profile = await getPublicProfile(handle);
    if (!profile) return { title: "Profile not found" };
    return buildPublicProfileMetadata({
      siteUrl: NEXT_PUBLIC_SITE_URL,
      profile,
    });
  } catch {
    return { title: "Public profile" };
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle: rawHandle } = await params;

  let profile;
  try {
    profile = await getPublicProfile(rawHandle);
  } catch (error) {
    if (error instanceof ZodError) notFound();
    throw error;
  }

  if (!profile) notFound();

  return (
    <main>
      <header className="masthead">
        <Link className="brand" href="/" aria-label="PROPER—RESPECT home">
          PROPER—RESPECT
        </Link>
        <p>PUBLIC USAGE RECORD / 001</p>
      </header>

      <section className="profile" aria-labelledby="profile-name">
        <div>
          <p className="eyebrow">LINKER / @{profile.handle}</p>
          <h1 id="profile-name">{profile.displayName}</h1>
        </div>
        <p className="bio">{profile.bio}</p>
      </section>

      <section className="stack" aria-labelledby="stack-heading">
        <div className="section-heading">
          <h2 id="stack-heading">THE STACK</h2>
          <p>{profile.cards.length.toString().padStart(2, "0")} ACTIVE RECORD</p>
        </div>

        {profile.cards.length === 0 ? (
          <div className="empty-state">
            <h3>No published products yet.</h3>
            <p>Draft and private records stay off this page.</p>
          </div>
        ) : (
          <div className="card-grid">
            {profile.cards.map((card) => (
              <ProductCard key={card.product.slug} card={card} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
