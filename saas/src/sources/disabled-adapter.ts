import type { SourceAdapter } from "@/types";

export function disabledAdapter(name: string): SourceAdapter {
  return { name, enabled: false, async scan() { return []; } };
}
