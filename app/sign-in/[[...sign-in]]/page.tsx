import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="system-message">
      <SignIn />
    </main>
  );
}
