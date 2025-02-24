import * as colors from "@std/fmt/colors";
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

export const LEVELS: string[] = ["debug", "info", "warn", "error", "off"] as const;
export const ICONS: string[] = ["🟢", "🔵", "🟡", "🔴", "🔕"] as const;
const COLORS = [colors.red, colors.yellow, colors.blue, colors.magenta, colors.cyan] as const;

// Original console if you ever want to go back to it
export const CONSOLE = globalThis.console;

// Set of rules to determine whether to enable a debug namespace
// deno-lint-ignore no-process-global
const DEBUGS_ALL = new Set<string>(process?.env.DEBUG?.trim().split(/[\s,]+/));
const DEBUGS_STAR = [...DEBUGS_ALL].filter((d) => d.endsWith("*")).map((d) => d.slice(0, -1));

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
  // Only the root hub can have a buffer
  buffer?: unknown[][] | undefined;
  compact = true;
  console?: Console;
  defaultLevel: typeof LEVELS[number] = "info";
  fileLine? = true;
  icons?: string | string[] = ICONS;
  timeDiff = true;
}

export const DEFAULTS = new Options() as Readonly<Options>;
const defaults = new Options();

// Cache of all instances created
const root = create("*");
const cache = new Map<string, Console & { level: string }>([["*", root]]);

// Private ON/OFF switch
let onOff = true;

// Utility function color deterministically based on the hash of the namespace (using djb2 XOR version)
// See https://gist.github.com/eplawless/52813b1d8ad9af510d85
function color(ns: string, apply = false, bold = true): string | number {
  const hash = (s: string) => [...s].reduce((h, c) => h * 33 ^ c.charCodeAt(0), 5381) >>> 0;
  const i = Math.abs(hash(ns)) % COLORS.length;
  return apply ? (bold ? colors.bold(COLORS[i](ns)) : COLORS[i](ns)) : i;
}

// Utility function to prefix the output (with namespace, fileLine, etc). We need to do this
// because we want to be 100% compatible with the console object

function parameters(args: unknown[], ns: string, level: number, options: Partial<Options> = defaults): unknown[] {
  // Add colors to the namespace (Deno takes care of removing if no TTY?)
  let prefix = color(ns, true, true) as string;

  // Figure fileLine option(s)
  const fileLine = options.fileLine ?? defaults.fileLine;
  const [f, l] = (fileLine ? new Error().stack?.split("\n")[3].split("/").pop()?.split(":") : []) as string[];
  if (fileLine) prefix = colors.underline(colors.white("[" + f + ":" + l + "]")) + " " + prefix;

  // Should we add icons?
  const icons = options.icons ?? defaults.icons;
  if (icons) prefix = (icons.at(level) ?? icons) + " " + prefix;

  // If compact is true apply util.instpect to all arguments being objects
  // deno-lint-ignore no-process-global
  const noColor = process?.env.NO_COLOR !== undefined;
  const inspectOptions = { breakLength: Infinity, colors: !noColor, compact: true, maxArrayLength: 25 };
  if (options.compact ?? defaults.compact) args = args.map((a) => typeof a === "object" ? util.inspect(a, inspectOptions) : a);

  // Organize parameters
  args = typeof args.at(0) === "string" ? [prefix + " " + args.shift(), ...args] : [prefix, ...args];

  // Add to buffer
  const length = defaults.buffer ? defaults.buffer.push([LEVELS[level], args]) : 0;
  if (length > 1000) throw new Error("Buffer is just meant for tests. If it has grown beyond '1,000' it probably means that you left it on by mistake.");

  // Should we add time?
  const timeDiff = options.timeDiff ?? defaults.timeDiff;
  if (timeDiff) args.push(COLORS[color(ns) as number]("+" + performance.measure(ns, ns).duration.toFixed(2).toString() + "ms"));
  performance.mark(ns);

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
  Object.assign(defaults, options);
  if (!debugs) return;
  DEBUGS_ALL.clear();
  DEBUGS_STAR.length = 0;
  for (const ns of debugs.trim().split(/[\s,]+/)) {
    DEBUGS_ALL.add(ns);
    if (ns.endsWith("*")) DEBUGS_STAR.push(ns.slice(0, -1));
  }
}

function create(ns: string, options: Partial<Options> = {}): Console & { level: string } {
  const debug = DEBUGS_ALL.has(ns) || DEBUGS_ALL.has("*") || DEBUGS_STAR.some((d) => ns.startsWith(d));
  let n = LEVELS.indexOf(debug ? "debug" : defaults.defaultLevel);

  // Create initial instance before decorating it with console methods
  performance.mark(ns);

  // deno-fmt-ignore
  const instance = {
    get level() { return LEVELS[n]; },
    set level(l: typeof LEVELS[number]) { n = LEVELS.indexOf(l); }
  } as Console & { level: string, time: number };

  // Get a pointer to the console to use internally (will be changed for testing)
  const c = defaults.console ?? CONSOLE;

  // deno-lint-ignore no-explicit-any
  LEVELS.slice(0, 4).forEach((l, i) => (instance as any)[l] = (...args: unknown[]) => n <= i && onOff ? (c as any)[l](...parameters(args, ns, i, options)) : () => {});
  instance.trace = (...args: unknown[]) => onOff ? c.trace(...args) : undefined;

  // Return completed prototype. It will NOT overwrite the previously defined functions
  // NOTE: By deleting the custom object versions we can go back to the prototype versions
  return Object.setPrototypeOf(instance, c) as Console & { level: string };
}

/**
 * Creates a console object (which you can think of as a soup-up console)
 * @param nsOrOnOff - Namespace, which is the name of the logger. Special values 'true' and 'false' will enable all or disable all
 * @param level - Level of logging
 * @param options - options for creation of logger
 * @returns - extended console
 */
export function hub(nsOrOnOff: boolean | string, level?: typeof LEVELS[number], options?: Partial<Options>): Console & { level: string } {
  if (typeof nsOrOnOff === "boolean") return onOff = nsOrOnOff, root;
  const ns = nsOrOnOff;
  if (!cache.has(ns)) cache.set(ns, create(ns));
  const instance = cache.get(ns) as Console & { level: string; options: Options };
  if (instance && level) instance.level = level;
  if (instance && options) Object.assign(instance.options, options);
  return instance;
}

// Export private functions so that we can test
export { color };
