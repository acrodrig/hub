import * as colors from "@std/fmt/colors";

/**
 * Hub - a spiritual successor to [debug-js](https://github.com/debug-js/debug)
 *
 * Simplest possible logging utility, wrapping console. Tries to support all of
 * debug-js features and is just as opinionated. The less decisions you have to make
 * when invoking, the more time you can spend on your actual code.
 *
 * It supports the following levels to match the console: `debug`, `info`, `warn`, `error`
 * and `off`.
 *
 * It can supplant the `console` object, but it is not recommended to use it in libraries.
 * It is useful for when you forget where you put your `console.log` statements and want to
 * turn them off quickly.
 *
 * It never touches `console.log` which is the most common method used in the wild. It does not
 * throw exceptions if you pass the wrong log level, but it will have the effect of printing
 * everything since the `n` level index will -1.
 *
 * Differences from `debug-js`:
 * - It does not support the `inspect` option
 * - It works not just for debug but for all levels
 * - It only allows for the ':' separator
 */

export const LEVELS: string[] = ["debug", "info", "warn", "error", "off", "log"] as const;
export const ICONS: string[] = ["🟢", "🔵", "🟡", "🔴", "🔕", "📣"] as const;
export const COLORS = [colors.red, colors.yellow, colors.blue, colors.magenta, colors.cyan] as const;

// Defaults
export const DEFAULTS = {
  buffer: undefined as unknown[][] | undefined,
  console: globalThis.console,
  fileLine: false,
  icons: true,
  level: "info" as typeof LEVELS[number],
  time: true,
};

// Cache of all instances created
const cache = new Map<string, Console & { level: string }>();

// Set of rules to determine whether to enable a debug namespace
const enabled = new Set<string>();

// Utility function color deterministically based on the hash of the namespace (using djb2 XOR version)
// See https://gist.github.com/eplawless/52813b1d8ad9af510d85
function color(ns: string, apply = false, bold = true): string | number {
  const hash = (s: string) => [...s].reduce((h, c) => h * 33 ^ c.charCodeAt(0), 5381) >>> 0;
  const i = Math.abs(hash(ns)) % COLORS.length;
  return apply ? (bold ? colors.bold(COLORS[i](ns)) : COLORS[i](ns)) : i;
}

// Utility function to prefix the output (with namespace, fileLine, etc). We need to do this
// because we want to be 100% compatible with the console object

function parameters(args: unknown[], ns: string, level: number, options: { fileLine?: boolean; icons?: boolean; time?: boolean }): unknown[] {
  // Add colors to the namespace (Deno takes care of removing if no TTY?)
  let prefix = color(ns, true, true) as string;

  // Figure fileLine option(s)
  const [f, l] = (options.fileLine ? new Error().stack?.split("\n")[3].split("/").pop()?.split(":") : []) as string[];
  if (options.fileLine) prefix = colors.underline(colors.white("[" + f + ":" + l + "]")) + " " + prefix;

  // Should we add icons?
  if (options.icons) prefix = ICONS[level] + " " + prefix;

  // Organize parameters
  args = typeof args.at(0) === "string" ? [prefix + " " + args.shift(), ...args] : [prefix, ...args];

  // Add to buffer
  const length = DEFAULTS.buffer ? DEFAULTS.buffer.push([LEVELS[level], args]) : 0;
  if (length > 1000) throw new Error("Buffer is just meant for tests. If it has grown beyond '1,000' it probably means that you left it on by mistake.");

  // Should we add time?
  if (options.time) args.push(COLORS[color(ns) as number]("+" + performance.measure(ns).duration.toFixed(2).toString() + "ms"));

  return args;
}

/**
 * Function to setup flags based on DEBUG environment variable. Used to enable
 * based on space or comma-delimited names.
 *
 * @param debug - debug string
 */
export function setup(debug: string = Deno.env.get("DEBUG") ?? ""): void {
  // Empty set, add all elements and return a copy
  enabled.clear();
  for (const ns of debug.split(/[\s,]+/)) enabled.add(ns);
}

/**
 * Creates a dash object (which you can think of as a soup-up console)
 * @param ns - Namespace, which is the name of the logger
 * @param level - Level of logging
 * @param logAlso - whether it should extend to console.log as well
 * @returns - extended console
 */
export function hub(ns: string, level?: typeof LEVELS[number], logAlso = false): Console & { level: string } {
  // Has it been created before? Only use cache if we are not changing options
  let instance = cache.get(ns);
  if (instance && level) instance.level = level;
  if (instance) return instance as Console & { level: string };

  // If we have not passed an *explicit* level and the namespace is enabled, set it to debug
  level ??= enabled.has(ns) || enabled.has("*") ? "debug" : DEFAULTS.level;

  // The outside world should never have access to `n`
  let n = LEVELS.indexOf(level);

  // Create initial instance before decorating it with console methods
  performance.mark(ns);

  // deno-fmt-ignore
  instance = { get level() { return LEVELS[n]; }, set level(l: typeof LEVELS[number]) { n = LEVELS.indexOf(l); }, time: Date.now() } as Console & { level: string, time: number };
  cache.set(ns, instance);

  // Get a pointer to the console to use internally (will be changed for testing)
  const c = DEFAULTS.console;

  // Add special version of `debug/info/warn/error`
  // deno-lint-ignore no-explicit-any
  LEVELS.slice(0, 4).forEach((l, i) => (instance as any)[l] = (...args: unknown[]) => n <= i ? (c as any)[l](...parameters(args, ns, i, DEFAULTS)) : () => {});

  // Replace the console.log in a different way that does not depend on levels
  if (logAlso) instance.log = (...args: unknown[]) => c.log(...parameters(args, ns, 5, DEFAULTS));

  // Return completed prototype. It will NOT overwrite the previously defined functions
  // NOTE: By deleting the custom object versions we can go back to the prototype versions
  return Object.setPrototypeOf(instance, c) as Console & { level: string };
}

// Setup
// setup();

// Export private functions so that we can test
export { color };
