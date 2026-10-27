import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONTENT_TYPES, getTypeDefinition, isContentType } from "@/core/taxonomy";
import { ClientGate } from "@/components/shell/client-gate";
import { LibraryView } from "@/components/views/library-view";

export function generateStaticParams() {
  return CONTENT_TYPES.map((type) => ({ type }));
}

export async function generateMetadata({ params }: PageProps<"/library/[type]">): Promise<Metadata> {
  const { type } = await params;
  return { title: isContentType(type) ? getTypeDefinition(type).label : "Library" };
}

export default async function Page({ params }: PageProps<"/library/[type]">) {
  const { type } = await params;
  if (!isContentType(type)) notFound();
  return (
    <ClientGate>
      <LibraryView type={type} />
    </ClientGate>
  );
}
