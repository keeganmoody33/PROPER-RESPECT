import type { PublicProfile } from "@/src/domain/public-profile";

export function ProfileName({ profile }: { profile: PublicProfile }) {
  const destination = profile.profileLinks?.find(link => link.url === profile.preferredLinkUrl);
  return destination ? <a href={destination.url} rel="me noreferrer">{profile.displayName}</a> : <>{profile.displayName}</>;
}

export function ProfileLinks({ profile }: { profile: PublicProfile }) {
  if (!profile.profileLinks?.length) return null;
  return <nav aria-label="Profile links"><ul>{profile.profileLinks.map((link, index) =>
    <li key={`${link.url}-${index}`}><a href={link.url} rel="me noreferrer">{link.label}</a></li>
  )}</ul></nav>;
}
