import { getChain, isEditable } from "@/lib/data";
import Tabs from "./Tabs";

export default async function ChainLayout({ children, params }: LayoutProps<"/chains/[id]">) {
  const { id } = await params;
  const chain = await getChain(id);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{chain.name}</h1>
      {chain.description && <p className="mt-1 text-sm text-ink-2">{chain.description}</p>}
      <Tabs id={chain.id} canRun={isEditable(chain)} />
      {children}
    </>
  );
}
