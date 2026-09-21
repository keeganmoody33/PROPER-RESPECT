import { SignUp } from "@clerk/nextjs";
import { AuthFrame } from "@/components/site-frame";

export default function SignUpPage() {
  return (
    <AuthFrame>
      <SignUp />
    </AuthFrame>
  );
}
