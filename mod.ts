export { CONSOLE, hub, LEVELS, setup } from "./src/hub.ts";

import { CONSOLE, hub, parameters } from "./src/hub.ts";

// Automatically setup the console replacement and export it? We do this if given a hash on import
const p: number = import.meta.url?.lastIndexOf("#");
const ns: string = p >= 0 ? import.meta.url?.substring(p + 1) : "";
const consoleReplacement: Console & { level?: string } = ns ? hub(ns) : CONSOLE;

// Replace console.log to print file and if env variable HUB is set
const log = console.log;
if (Deno.env.has("HUB")) console.log = (...args: unknown[]) => log(...parameters(args, "*", 5));

export { consoleReplacement as  console };
