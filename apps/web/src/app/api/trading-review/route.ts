import { handler, ok, requireValue } from "@/server/api";
import { listPersonalJournal } from "@/server/personal-journal";
import { listReviews, saveReview } from "@/server/trading-review";
import {listPersonalAccounts} from '@/server/personal-accounts';

export const GET = handler(() => {
  const journal = listPersonalJournal();
  const accountData=listPersonalAccounts();
  return ok({
    reviews: listReviews(),
    entries: journal.entries.filter((entry) => entry.mode === "Forward"),
    terms: journal.terms,
    accountScopes:accountData.accounts.map(account=>({id:account.id,name:account.name,firmId:account.profile?.kind==='prop'?account.profile.firmId:null})),
    firms:accountData.firms.map(firm=>({id:firm.id,name:firm.name})),
  });
});
export const POST = handler(async (request: Request) => {
  const body = await request.json();
  requireValue(body && typeof body === "object" && !Array.isArray(body), "Некорректный запрос");
  return ok({ review: saveReview(body) });
});
