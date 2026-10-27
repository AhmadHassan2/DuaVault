"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { FolderHeart, Plus } from "lucide-react";
import { useCollections, useItems } from "@/lib/data/hooks";
import { getRepository } from "@/lib/data/repository";
import { errorMessage } from "@/lib/actions";
import { EmptyState, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const IDEAS = ["Duas for my parents", "Before exams", "Ramadan", "Daily adhkar", "Reminders for hard times", "Things I want to memorize"];

export function NewCollectionDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = async () => {
    try {
      await getRepository().createCollection(name, description);
      toast.success(`Created “${name.trim()}”`);
      setOpen(false);
      setName("");
      setDescription("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>Collections can hold duas, verses, reminders — anything that belongs together.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void create();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="col-name">Name</Label>
            <Input id="col-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => setName(idea)} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                  {idea}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="col-desc">Description (optional)</Label>
            <Input id="col-desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim()}>
              Create collection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionsView() {
  const collections = useCollections();
  const items = useItems();
  const byId = new Map((items.data ?? []).map((i) => [i.id, i]));

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Group items for a person, an occasion or a season."
        actions={
          <NewCollectionDialog
            trigger={
              <Button>
                <Plus /> New
              </Button>
            }
          />
        }
      />
      {collections.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="paper-card h-36 animate-pulse" />
          ))}
        </div>
      ) : collections.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.data.map((c) => {
            const first = c.itemIds.map((id) => byId.get(id)).find(Boolean);
            return (
              <Link key={c.id} href={`/collections/${c.id}`} className="paper-card flex flex-col gap-2 p-5 transition-transform hover:-translate-y-0.5">
                <FolderHeart className="size-5 text-gold" />
                <h2 className="text-xl font-medium">{c.name}</h2>
                {c.description && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                {first?.arabicText && (
                  <p lang="ar" dir="rtl" className="arabic line-clamp-1 text-right text-lg text-foreground/70">
                    {first.arabicText}
                  </p>
                )}
                <p className="mt-auto pt-2 text-xs text-muted-foreground">
                  {c.itemIds.length} {c.itemIds.length === 1 ? "item" : "items"}
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={FolderHeart}
          title="No collections yet"
          description="Try “Duas for my parents”, “Before exams” or “Ramadan”."
          action={
            <NewCollectionDialog
              trigger={
                <Button>
                  <Plus /> Create your first
                </Button>
              }
            />
          }
        />
      )}
    </div>
  );
}
