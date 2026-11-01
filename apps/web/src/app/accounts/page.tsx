import { Suspense } from "react";
import { PersonalAccounts } from "@/components/personal-accounts";
export default function AccountsPage() {
  return (
    <Suspense>
      <PersonalAccounts />
    </Suspense>
  );
}
