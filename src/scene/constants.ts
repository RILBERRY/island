export const LAND_Y = 1.2;
export const WALK_SPEED = 2.6;
export const RUN_SPEED = 4.6;
export const EMOTE_MS = 2600;
export const RENDER_LABEL_DISTANCE = 140;

/** Stable DOM layer that drei <Html> portals into (avoids an empty-label bug when R3F reconnects events). */
export const labelPortal = { current: null as unknown as HTMLDivElement };
