import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/components/site-frame";

export default function SignInPage() {
  return (
    <AuthFrame>
      <SignIn />
    </AuthFrame>
  );
}
