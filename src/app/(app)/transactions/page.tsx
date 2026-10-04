import type { Metadata } from "next";
import { TransactionsView } from "@/components/transactions-view";

export const metadata: Metadata = { title: "รายการ" };

export default async function Page({ searchParams }: PageProps<"/transactions">) {
  return <TransactionsView kind="all" searchParams={await searchParams} />;
}
