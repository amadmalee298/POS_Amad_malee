import type { Metadata } from "next";
import { TransactionsView } from "@/components/transactions-view";

export const metadata: Metadata = { title: "รายรับ" };

export default async function Page({ searchParams }: PageProps<"/transactions/income">) {
  return <TransactionsView kind="income" searchParams={await searchParams} />;
}
