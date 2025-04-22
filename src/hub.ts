import * as colors from "@std/fmt/colors";
import { omit } from "@std/collections";
import { resolve } from "@std/path";
import util from "node:util";

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

export const LEVELS: string[] = ["debug", "info", "warn", "error", "log", "off"] as const;
export const ICONS: string[] = ["🟢", "🔵", "🟡", "🔴", "🟤", "🔕"] as const;
const COLORS = [colors.red, colors.yellow, colors.blue, colors.magenta, colors.cyan] as const;

// Original console if you ever want to go back to it
export const CONSOLE = omit(globalThis.console, ["table"]) as Console;

// Set of rules to determine whether to enable a debug namespace
// deno-lint-ignore no-process-global
const DEBUGS_ALL = new Set<string>(process?.env.DEBUG?.trim().split(/[\s,]+/));
const DEBUGS_STAR = [...DEBUGS_ALL].filter((d) => d.endsWith("*")).map((d) => d.slice(0, -1));

// Buffer used to debug (off by default)
export const BUFFER: string[][] = [];

/**
 * Default options for the hub
 * @param buffer - Buffer to store messages
 * @param compact - Compact mode (util.inspect)
 * @param console - Console object to use
 * @param defaultLevel - Default level to use
 * @param fileLine - Whether to show file and line
 * @param icons - Whether to show icons (if available)
 * @param timeDiff - Whether to show time difference
 * @param colors - Colors to use
 */
export class Options {
  buffer = false;
  compact = true;
  console?: Console;
  defaultLevel: typeof LEVELS[number] = "info";
  fileLine? = true;
  icons?: string | string[] = ICONS;
  root: string = "";
  timeDiff = true;
}

export const DEFAULTS = new Options() as Readonly<Options>;

// Cache of all instances created
const cache = new Map<string, Console & { level: string; options: Options }>();

// Private ON/OFF switch
let onOff = true;

// Utility function color deterministically based on the hash of the namespace (using djb2 XOR version)
// See https://gist.github.com/eplawless/52813b1d8ad9af510d85
export function color(ns: string, apply = false, bold = true): string | number {
  const hash = (s: string) => [...s].reduce((h, c) => h * 33 ^ c.charCodeAt(0), 5381) >>> 0;
  const i = Math.abs(hash(ns)) % COLORS.length;
  return apply ? (bold ? colors.bold(COLORS[i](ns)) : COLORS[i](ns)) : i;
}

// Find correct instance based on filename
function findInstance(filename: string) {
  for (const [_, i] of cache) {
    if (filename.startsWith(i.options.root)) return i;
  }
}

// Utility function to prefix the output (with namespace, fileLine, etc). We need to do this
// because we want to be 100% compatible with the console object

export function parameters(args: unknown[], ns: string, level: number, options: Partial<Options> = DEFAULTS, line: string): unknown[] {
  // Add colors to the namespace (Deno takes care of removing if no TTY?)
  let prefix = ns === "*" ? "" : color(ns, true, true) as string;

  // Figure fileLine option(s)
  const fileLine = options.fileLine ?? DEFAULTS.fileLine;
  const [b, l] = (fileLine ? line.split("/").pop()?.split(":") : []) as string[];
  if (fileLine) prefix = colors.underline(colors.white("[" + b + ":" + l + "]")) + " " + prefix;

  // Should we add icons?
  const icons = options.icons ?? DEFAULTS.icons;
  if (icons) prefix = (icons.at(level) ?? icons) + " " + prefix;

  // If compact is true apply util.inspect to all arguments being objects
  // deno-lint-ignore no-process-global
  const noColor = process?.env.NO_COLOR !== undefined;
  const inspectOptions = { breakLength: Infinity, colors: !noColor, compact: true, maxArrayLength: 25 };
  if (options.compact ?? DEFAULTS.compact) args = args.map((a) => typeof a === "object" ? util.inspect(a, inspectOptions) : a);

  // Organize parameters
  args = typeof args.at(0) === "string" ? [prefix + (ns === "*" ? "" : " ") + args.shift(), ...args] : [prefix, ...args];

  // Should we add time?
  const timeDiff = options.timeDiff ?? DEFAULTS.timeDiff;
  if (timeDiff) args.push(COLORS[color(ns) as number]("+" + performance.measure(ns, ns).duration.toFixed(2).toString() + "ms"));
  performance.mark(ns);

  // Add to buffer
  const buffer = options.buffer || DEFAULTS.buffer;
  const length = buffer ? BUFFER.push([LEVELS[level], ...args as string[]]) : 0;
  if (length > 1000) throw new Error("Buffer is just meant for tests. If it has grown beyond '1,000' it probably means that you left it on by mistake.");

  return args;
}

/**
 * Function to setup flags based on DEBUG environment variable. Used to enable
 * based on space or comma-delimited names.
 *
 * @param options - options for setup
 * @param debugs
 */
export function setup(options: Partial<Options> = {}, debugs?: string): void {
  Object.assign(DEFAULTS, options);
  if (!debugs) return;
  DEBUGS_ALL.clear();
  DEBUGS_STAR.length = 0;
  for (const ns of debugs.trim().split(/[\s,]+/)) {
    DEBUGS_ALL.add(ns);
    if (ns.endsWith("*")) DEBUGS_STAR.push(ns.slice(0, -1));
  }
}

function create(ns: string, options: Partial<Options> = {}): Console & { level: string; options: Options } {
  const debug = DEBUGS_ALL.has(ns) || DEBUGS_ALL.has("*") || DEBUGS_STAR.some((d) => ns.startsWith(d));
  let n = LEVELS.indexOf(debug ? "debug" : DEFAULTS.defaultLevel);

  // Create initial instance before decorating it with console methods
  performance.mark(ns);

  // Make sure the root is resolved
  if (options.root) options.root = resolve(options.root);

  // deno-fmt-ignore
  const instance = {
    get level() { return LEVELS[n]; },
    set level(l: typeof LEVELS[number]) { n = LEVELS.indexOf(l); },
  } as Console & { level: string; options: Options };

  // Get a pointer to the console to use internally (will be changed for testing)
  const c = DEFAULTS.console ?? CONSOLE;

  const max = Deno.env.get("HUB") === "log" ? 5 : 4;

  LEVELS.slice(0, max).forEach((l, i) =>
    // deno-lint-ignore no-explicit-any
    (instance as any)[l] = (...args: unknown[]) => {
      const line = new Error().stack?.split("\n")[2]!;
      // Try to find an alternate namespace
      if (ns === "*") {
        const instance = findInstance(line.split("file://")[1]);
        // deno-lint-ignore no-explicit-any
        if (instance) return (instance as any)[l](...args);
      }
      // deno-lint-ignore no-explicit-any
      return n <= i && onOff ? (c as any)[l](...parameters(args, ns, i, options, line)) : () => {};
    }
  );
  instance.trace = (...args: unknown[]) => onOff ? c.trace(...args) : undefined;

  // Set options used in closure to be able to manipulate in the future
  instance.options = options as Options;

  // Return completed prototype. It will NOT overwrite the previously defined functions
  // NOTE: By deleting the custom object versions we can go back to the prototype versions
  return Object.setPrototypeOf(instance, c) as Console & { level: string; options: Options };
}

/**
 * Creates a console object (which you can think of as a soup-up console)
 * @param nsOrOnOff - Namespace, which is the name of the logger. Special values 'true' and 'false' will enable all or disable all
 * @param level - Level of logging
 * @param options - options for creation of logger
 * @param force - Force creation of a new instance
 * @returns - extended console
 */
export function hub(nsOrOnOff: boolean, level?: typeof LEVELS[number], options?: Partial<Options>, force?: boolean): boolean;
export function hub(nsOrOnOff: string, level?: typeof LEVELS[number], options?: Partial<Options>, force?: boolean): Console & { level: string };
export function hub(nsOrOnOff: boolean | string, level?: typeof LEVELS[number], options: Partial<Options> = {}, force = false): boolean | Console & { level: string } {
  if (typeof nsOrOnOff === "boolean") return onOff = nsOrOnOff;
  const ns = nsOrOnOff;
  if (!cache.has(ns) || force) cache.set(ns, create(ns, options));
  const instance = cache.get(ns) as Console & { level: string; options: Options };
  if (level) instance.level = level;
  if (options) Object.assign(instance.options, options);
  return instance;
}

const rootLevel = Deno.env.get("HUB");
export const ROOT = hub("*", rootLevel ?? "debug");

// deno-lint-ignore no-global-assign
if (rootLevel) console = ROOT;
