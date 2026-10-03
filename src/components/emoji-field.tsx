"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EMOJI_CHOICES } from "@/lib/constants";

export function EmojiField({ defaultValue, name = "icon" }: { defaultValue: string; name?: string }) {
  const [value, setValue] = useState(defaultValue);
  const choices = EMOJI_CHOICES.includes(value) ? EMOJI_CHOICES : [value, ...EMOJI_CHOICES];
  return (
    <div className="grid gap-1.5">
      <Label>ไอคอน</Label>
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-9 gap-1">
        {choices.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={e}
            aria-pressed={value === e}
            onClick={() => setValue(e)}
            className={cn(
              "grid aspect-square place-items-center rounded-md text-lg hover:bg-muted",
              value === e && "bg-primary/15 ring-2 ring-primary",
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
