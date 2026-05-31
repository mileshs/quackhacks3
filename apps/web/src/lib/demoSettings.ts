/** Short-run demo limits (walls = 8-count tempo cycles). */
export type DemoWallCount = 1 | 5;

export const DEMO_WALL_COUNT_OPTIONS: DemoWallCount[] = [1, 5];

/** True once the dummy has finished the configured number of demo walls. */
export function isDemoRunComplete(cycle: number, wallCount: DemoWallCount): boolean {
  return cycle >= wallCount;
}
