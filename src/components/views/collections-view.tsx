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

export function NewCollectionDialog({ trigger, suggestedName = "" }: { trigger: React.ReactNode; suggestedName?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [description, setDescription] = useState("");
  const create = async () => {
    try {
      await getRepository().createCollection(name, description);
      toast.success(`Created “${name.trim()}”`);
      setOpen(false);
      setName(suggestedName);
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
        eyebrow="Organize your duas"
        title="Collections"
        description="Group duas and reminders by topic, occasion or person."
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
      <div className="grid items-start gap-10 lg:grid-cols-[18rem_1fr] xl:gap-14">
      <aside className="lg:sticky lg:top-6">
        <div className="sanctuary-panel p-6"><FolderHeart aria-hidden="true" className="mb-5 size-8 text-primary" /><h2 className="text-3xl leading-tight">Collections for daily practice.</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Organize daily adhkar, duas for your family and material you are memorizing.</p><p className="mt-6 border-t pt-4 text-sm text-primary">{collections.data?.length ?? 0} personal collections</p></div>
        <p className="eyebrow mt-7 mb-3">Suggested collections</p>
        <div className="divide-y">{IDEAS.slice(0, 4).map((idea)=><NewCollectionDialog key={idea} suggestedName={idea} trigger={<button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-sm text-muted-foreground hover:text-primary">{idea}<Plus aria-hidden="true" className="size-4 shrink-0" /></button>} />)}</div>
      </aside>
      <section className="min-w-0" aria-label="Your collection shelves">
      {collections.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="paper-card h-36 animate-pulse" />
          ))}
        </div>
      ) : collections.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collections.data.map((c) => {
            const first = c.itemIds.map((id) => byId.get(id)).find(Boolean);
            return (
              <Link key={c.id} href={`/collections/${c.id}`} className="paper-card interactive-card flex flex-col gap-3 p-6">
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary"><FolderHeart aria-hidden="true" className="size-6 text-secondary-foreground" /></span>
                <h2 className="text-2xl font-medium">{c.name}</h2>
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
      </section>
      </div>
    </div>
  );
}
