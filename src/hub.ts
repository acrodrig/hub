import * as colors from "@std/fmt/colors";
import { globToRegExp } from "@std/path";
import util from "node:util";

/**
 * Hub - a spiritual successor to [debug-js](https://github.com/debug-js/debug)
 *
 * Simplest possible logging utility, wrapping console. Tries to support all of
 * debug-js features and is just as opinionated. The less decisions you have to make
 * when invoking, the more time you can spend on your actual code.
 *
 * It supports the following levels to match the console: `all`, `debug`, `info`, `warn`,
 * `error` and `off`.
 *
 * It can supplant the `console` object, but it is not recommended to use it in libraries.
 * It is useful for when you forget where you put your `console.log` statements and want to
 * know where they are to turn them off quickly.
 *
 * It never touches `console.log` which is the most common method used in the wild. It does not
 * throw exceptions if you pass the wrong log level, but it will have the effect of printing
 * everything since the `n` level index will -1.
 *
 * Differences from `debug-js`:
 * - It does not support the `inspect` option
 * - It works not just for debug but for all levels
 * - It works with globs, now with log names and separators
 */

export const LEVELS: string[] = ["debug", "info", "warn", "error", "log", "off"] as const;
export const ICONS: string[] = ["🟢", "🔵", "🟡", "🔴", "🟤", "🔕"] as const;
export const GLOBS: RegExp[][] = LEVELS.map((_) => []);
const COLORS = [colors.red, colors.yellow, colors.blue, colors.magenta, colors.cyan] as const;

// A map from level names to ordinals
const ORDINALS = new Map(LEVELS.map((l, i) => [l, i]));

// Original methods
const ORIGINALS = { debug: console.debug, warn: console.warn, info: console.info, error: console.error, log: console.log };

// Buffer used to debug (off by default)
export const BUFFER: string[][] = [];

/**
 * Default options for the hub
 * @param buffer - Buffer to store messages
 * @param compact - Compact mode (util.inspect)
 * @param fileLine - Whether to show file and line
 * @param icons - Whether to show icons (if available)
 * @param timeDiff - Whether to show time difference
 * @param colors - Colors to use
 */
export class Options {
  buffer = false;
  compact = true;
  fileLine? = true;
  icons?: string | string[] = ICONS;
  root: string = "";
  timeDiff = true;
}

// See https://github.com/nodejs/node/issues/7749#issuecomment-232972234
class StackError extends Error {
  constructor() {
    super();
    // deno-lint-ignore no-explicit-any
    const original = (Error as any).prepareStackTrace;
    try {
      // deno-lint-ignore no-explicit-any
      (Error as any).prepareStackTrace = (_: Error, callsites: any[]) => callsites;
      Error.captureStackTrace(this);
      // NOTE: needed to invoke the getter for stack
      this.stack;
    } finally {
      // deno-lint-ignore no-explicit-any
      (Error as any).prepareStackTrace = original;
    }
  }
}

export const DEFAULTS: Options = new Options();

// Cache of all instances created
const cache = new Map<string, Console & { level: string; options: Options }>();

// Utility function color deterministically based on the hash of the namespace (using djb2 XOR version)
// See https://gist.github.com/eplawless/52813b1d8ad9af510d85
export function color(ns: string, apply = false, bold = true): string | number {
  const hash = (s: string) => [...s].reduce((h, c) => h * 33 ^ c.charCodeAt(0), 5381) >>> 0;
  const i = Math.abs(hash(ns)) % COLORS.length;
  return apply ? (bold ? colors.bold(COLORS[i](ns)) : COLORS[i](ns)) : i;
}

// Utility function to prefix the output (with namespace, fileLine, etc). We need to do this
// because we want to be 100% compatible with the console object
// deno-lint-ignore no-explicit-any
function parameters(args: unknown[], ns: string, level: number, options: Partial<Options> = {}, callsite: any): unknown[] {
  // Add colors to the namespace (Deno takes care of removing if no TTY?)
  let prefix = ns === "*" ? "" : color(ns, true, true) as string;

  // Figure fileLine option(s)
  const fileLine = options.fileLine ?? DEFAULTS.fileLine;
  const basename = callsite.getFileName().split("/").pop();
  if (fileLine) prefix = colors.underline(colors.white("[" + basename + ":" + callsite.getLineNumber() + "]")) + " " + prefix;

  // Should we add icons?
  const icons = options.icons ?? DEFAULTS.icons;
  if (icons) prefix = (icons.at(level) ?? icons) + " " + prefix;

  // If compact is true apply util.inspect to all arguments being objects
  const noColor = Deno.env.get("NO_COLOR") !== undefined;
  const inspectOptions = { breakLength: Infinity, colors: !noColor, compact: true, maxArrayLength: 25 };
  if (options.compact ?? DEFAULTS.compact) args = args.map((a) => typeof a === "object" ? util.inspect(a, inspectOptions) : a);

  // Organize parameters
  args = typeof args.at(0) === "string" ? [prefix + (ns === "*" ? "" : " ") + args.shift(), ...args] : [prefix, ...args];

  // Should we add time?
  const timeDiff = options.timeDiff ?? DEFAULTS.timeDiff;
  if (timeDiff) args.push(colors.white("+" + performance.measure(ns, ns).duration.toFixed(2).toString() + "ms"));
  performance.mark(ns);

  // Add to buffer
  const buffer = options.buffer || DEFAULTS.buffer;
  const length = buffer ? BUFFER.push([LEVELS[level], ...args as string[]]) : 0;
  if (length > 1000) throw new Error("Buffer is just meant for tests. If it has grown beyond '1,000' it probably means that you left it on by mistake.");

  return args;
}

/**
 * Function to set up flags based on environment variable. Used to enable
 * based on space or comma-delimited names.
 *
 * @param level
 * @param value
 */
export function configure(level: typeof LEVELS[number], value = Deno.env.get(level.toUpperCase())): void {
  const n = ORDINALS.get(level)!;
  GLOBS[n] = value?.trim().split(/[\s,]+/).filter((g) => g.length).map((g) => globToRegExp(g)) ?? [];

  // Reset levels (potentially costly if too many logs)
  for (const [ns, i] of cache) i.level = getLevel(ns);
}

function getLevel(ns: string) {
  for (let l = GLOBS.length - 1; l >= 0; l--) {
    if (GLOBS[l].some((re) => re.test(ns))) return LEVELS[l];
  }
  return "info";
}

function create(namespace: string, options: Partial<Options> = {}): Console & { level: string; options: Options } {
  // Get the level for the log
  const level = getLevel(namespace);
  let ordinal = ORDINALS.get(level)!;

  // Create the initial instance before decorating it with console methods
  performance.mark(namespace);

  // deno-fmt-ignore
  const instance = {
    get level() { return LEVELS[ordinal]; },
    set level(l: typeof LEVELS[number]) { ordinal = ORDINALS.get(l)!; },
  } as Console & { level: string; options: Options };

  LEVELS.slice(0, 4).forEach((l, i) =>
    // deno-lint-ignore no-explicit-any
    (instance as any)[l] = (...args: unknown[]) => {
      // See https://github.com/nodejs/node/issues/7749#issuecomment-232972234
      // deno-lint-ignore no-explicit-any
      const callsites = new StackError().stack! as unknown as any[];
      const callsite = callsites[2]!;
      const fileName = callsite.getFileName()!;

      // Try to find an alternate namespace if defined
      if (namespace === "*") {
        const entry = cache.entries().find(([_, i]) => fileName.startsWith(i.options.root));
        if (entry) {
          const ns = entry[0], o = ORDINALS.get(entry[1].level)!;
          console.log(ns, l, args);
          // deno-lint-ignore no-explicit-any
          return o <= i ? (ORIGINALS as any)[l](...parameters(args, ns, i, options, callsite)) : () => {};
        }
      }

      // deno-lint-ignore no-explicit-any
      return ordinal <= i ? (ORIGINALS as any)[l](...parameters(args, namespace, i, options, callsite)) : () => {};
    }
  );

  // Set options used in closure to be able to manipulate in the future
  instance.options = options as Options;

  // Return the completed prototype. It will NOT overwrite the previously defined functions
  // NOTE: By deleting the custom object versions we can go back to the prototype versions
  return Object.setPrototypeOf(instance, console) as Console & { level: string; options: Options };
}

export function hub(ns: string, options: Partial<Options> = {}, force = false): Console & { level: string } {
  if (!cache.has(ns) || force) cache.set(ns, create(ns, options));
  const instance = cache.get(ns) as Console & { level: string; options: Options };
  if (options) Object.assign(instance.options, options);
  return instance;
}

// Configure based on environment variables
for (const level of LEVELS) configure(level);
