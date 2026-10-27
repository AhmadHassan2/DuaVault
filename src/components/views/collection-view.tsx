"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FileQuestion, FolderHeart, Pencil, Trash2, X } from "lucide-react";
import { useCollections, useItems, useProgress } from "@/lib/data/hooks";
import { getRepository } from "@/lib/data/repository";
import { errorMessage } from "@/lib/actions";
import { EmptyState, PageHeader } from "@/components/common";
import { ItemCard } from "@/components/items/item-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function CollectionView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const collections = useCollections();
  const items = useItems();
  const progress = useProgress();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  if (collections.loading || items.loading) return <div className="paper-card h-64 animate-pulse" />;
  const c = collections.data?.find((x) => x.id === id);
  if (!c) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Collection not found"
        action={
          <Button asChild variant="outline">
            <Link href="/collections">All collections</Link>
          </Button>
        }
      />
    );
  }
  const members = c.itemIds.map((iid) => items.data?.find((i) => i.id === iid)).filter((i) => !!i);
  const progressById = new Map((progress.data ?? []).map((p) => [p.itemId, p.state]));

  return (
    <div>
      <PageHeader
        title={
          renaming ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await getRepository().updateCollection(c.id, { name: name.trim() || c.name });
                  setRenaming(false);
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-11 font-display text-2xl" maxLength={80} />
            </form>
          ) : (
            c.name
          )
        }
        description={c.description || undefined}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setName(c.name);
                setRenaming((r) => !r);
              }}
            >
              <Pencil /> Rename
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive">
                  <Trash2 /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{c.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>The items stay in your library — only the collection is removed.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await getRepository().deleteCollection(c.id);
                      router.push("/collections");
                    }}
                  >
                    Delete collection
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
      {members.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((item) => (
            <div key={item.id} className="group relative">
              <ItemCard item={item} memorization={progressById.get(item.id)} />
              <button
                type="button"
                aria-label={`Remove ${item.title} from collection`}
                onClick={() => getRepository().setCollectionMembership(c.id, item.id, false)}
                className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-background/90 text-muted-foreground opacity-100 shadow-sm transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderHeart}
          title="This collection is empty"
          description="Open any saved item and choose “Add to collection”."
          action={
            <Button asChild variant="outline">
              <Link href="/library">Browse library</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
