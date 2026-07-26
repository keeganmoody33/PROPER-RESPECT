import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { ProductCard } from "@/components/product-card";
import { getPublicProfile } from "@/src/data/get-public-profile";

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  try {
    const profile = await getPublicProfile(handle);
    if (!profile) return { title: "Profile not found" };
    return {
      title: profile.displayName,
      description: profile.bio,
    };
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
        <p>@{profile.handle} / LIVE PRODUCT ACTIVITY</p>
      </header>

      <section className="stack" aria-labelledby="stack-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PUBLIC PRODUCT IDENTITY</p>
            <h1 id="stack-heading">The stack, with receipts.</h1>
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
                key={card.product.slug}
                card={card}
                index={index}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="profile-footer">
        <div>
          <strong>{profile.displayName}</strong>
          <span>@{profile.handle}</span>
        </div>
        <p>{profile.bio}</p>
        <Link href="/onboarding">Build your PROPER—RESPECT profile →</Link>
      </footer>
    </main>
  );
}
