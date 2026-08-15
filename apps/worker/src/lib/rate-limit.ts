export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * No rate-limiter bindings are declared in wrangler.toml yet. Later tickets
 * (auth, PT-11+) add entries here, e.g. `AUTH_RATE_LIMITER: RateLimiterBinding`,
 * and wire the matching binding into wrangler.toml. Because this map starts
 * empty, referencing any binding name against it is a TypeScript compile error
 * until it's declared here.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentionally empty; later tickets add binding names here via declaration merging
export interface RateLimitBindings {}
