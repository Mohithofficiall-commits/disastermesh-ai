import { createServerFn } from "@tanstack/react-start";
import type { SyncEvent } from "@/types";

export interface PushEventsInput {
  eventsJson: string;
}

export interface PullEventsInput {
  sinceTimestamp: number;
}

export const pushRelayEventsFn = createServerFn({ method: "POST" })
  .validator((data: PushEventsInput) => data)
  .handler(async ({ data }): Promise<{ inserted: number }> => {
    const { pushRelayEvents } = await import("./mesh-relay.server.ts");
    let events: SyncEvent[] = [];
    try {
      events = JSON.parse(data.eventsJson);
    } catch {
      events = [];
    }
    return pushRelayEvents(events);
  });

export const pullRelayEventsFn = createServerFn({ method: "GET" })
  .validator((data: PullEventsInput) => data)
  .handler(async ({ data }): Promise<{ eventsJson: string }> => {
    const { pullRelayEvents } = await import("./mesh-relay.server.ts");
    const events = await pullRelayEvents(data.sinceTimestamp);
    return { eventsJson: JSON.stringify(events) };
  });
