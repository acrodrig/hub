#!/usr/bin/env -S deno test -A

import { assertEquals, assertMatch } from "@std/assert";
import { delay } from "jsr:@std/async";
import * as colors from "@std/fmt/colors";
import { color, DEFAULTS, hub } from "../src/hub.ts";

// We set a buffer to capture console.log messages
const buffer = DEFAULTS.buffer = [];
const reset = { ...DEFAULTS };

Deno.test("Basic", () => {
  Object.assign(DEFAULTS, { fileLine: false, icons: true, time: false });
  const log = hub("test");

  // Test that we do NOT touch console.log, and default level is "info"
  log.debug("debug");
  log.info("info");
  log.warn("warn");
  log.error("error");
  log.log("log");

  // Test validity
  const prefix = color("test", true);
  assertEquals(buffer, [["info", ["🔵 " + prefix + " info"]], ["warn", ["🟡 " + prefix + " warn"]], ["error", ["🔴 " + prefix + " error"]]]);
  buffer.length = 0;

  Object.assign(DEFAULTS, reset);
});

Deno.test("File/Lines and Time (with debug level)", async () => {
  Object.assign(DEFAULTS, { fileLine: true, icons: false, time: true });
  const log = hub("test", "debug");

  log.debug("debug");
  await delay(10);
  log.log("log");

  // Test validity
  const prefix = color("test", true);
  const fileLine = colors.underline(colors.white("[hub.test.ts:35]"));
  const time = buffer[0][1][1];
  assertEquals(buffer, [["debug", [fileLine + " " + prefix + " debug", buffer[0][1][1]]]]);
  assertMatch(time, /\+\d+\.\d+ms/);
  buffer.length = 0;

  Object.assign(DEFAULTS, reset);
});

Deno.test("Console Replacement", () => {
  const ns = ":console:", prefix = color(ns, true);

  // Replace the native console (start)
  // deno-lint-ignore no-global-assign
  console = hub(ns, undefined, true);

  // Test validity
  console.warn("warn");
  assertEquals(buffer, [["warn", ["🟡 " + prefix + " warn", buffer[0][1][1]]]]);

  // Test validity
  console.log("log");
  assertEquals(buffer, [["warn", ["🟡 " + prefix + " warn", buffer[0][1][1]]], ["log", ["📣 " + prefix + " log", buffer[1][1][1]]]]);
  assertEquals(buffer.length, 2);

  // End the replacement
  // deno-lint-ignore no-global-assign
  console = DEFAULTS.console;

  // Test validity (buffer no longer increments)
  console.error("error");
  assertEquals(buffer.length, 2);
});
