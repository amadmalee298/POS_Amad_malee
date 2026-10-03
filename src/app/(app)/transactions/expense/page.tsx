import type { Metadata } from "next";
import { TransactionsView } from "@/components/transactions-view";

export const metadata: Metadata = { title: "รายจ่าย" };

export default async function Page({ searchParams }: PageProps<"/transactions/expense">) {
  return <TransactionsView kind="expense" searchParams={await searchParams} />;
}
