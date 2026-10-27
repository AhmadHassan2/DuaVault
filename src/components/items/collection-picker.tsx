"use client";

import { useState } from "react";
import { FolderPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCollections } from "@/lib/data/hooks";
import { getRepository } from "@/lib/data/repository";
import { errorMessage } from "@/lib/actions";

export function CollectionPicker({ itemId }: { itemId: string }) {
  const collections = useCollections();
  const [name, setName] = useState("");

  const toggle = async (collectionId: string, member: boolean) => {
    try {
      await getRepository().setCollectionMembership(collectionId, itemId, member);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    try {
      const c = await getRepository().createCollection(name);
      await getRepository().setCollectionMembership(c.id, itemId, true);
      setName("");
      toast.success(`Added to “${c.name}”`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const count = (collections.data ?? []).filter((c) => c.itemIds.includes(itemId)).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <FolderPlus /> {count ? `In ${count} collection${count > 1 ? "s" : ""}` : "Add to collection"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="mb-2 text-sm font-medium">Collections</p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {(collections.data ?? []).map((c) => {
            const checked = c.itemIds.includes(itemId);
            return (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox checked={checked} onCheckedChange={(v) => toggle(c.id, v === true)} />
                <span className="truncate">{c.name}</span>
              </label>
            );
          })}
          {!collections.data?.length && <p className="px-2 py-1 text-sm text-muted-foreground">No collections yet.</p>}
        </div>
        <form
          className="mt-3 flex gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection" className="h-8" maxLength={80} />
          <Button type="submit" size="icon" aria-label="Create collection" disabled={!name.trim()}>
            <Plus />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
