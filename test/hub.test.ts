#!/usr/bin/env -S deno test -A

import { assertEquals, assertGreaterOrEqual, assertLess, assertMatch } from "@std/assert";
import { delay } from "@std/async";
import * as colors from "@std/fmt/colors";
import { BUFFER, color, configure, DEFAULTS, hub, ICONS, type Options } from "../src/hub.ts";

// We set a buffer to capture console.log messages
const reset = (options: Partial<Options> = {}) => {
  BUFFER.length = 0;
  const defaults = { buffer: true, compact: true, defaultLevel: "info", fileLine: false, icons: ICONS, timeDiff: true };
  Object.assign(DEFAULTS, defaults, options);
};

Deno.test("Basic (no files, no times)", () => {
  reset({ fileLine: false, timeDiff: false });

  const log = hub("test");

  // Test that we do NOT touch console.log, and the default level is "info"
  log.debug("debug");
  log.info("info");
  log.warn("warn");
  log.error("error");
  log.log("log");

  // Added to the test that console.log is not touched
  console.log("log");

  // Test validity
  const prefix = color("test", true);
  assertEquals(BUFFER, [["info", "🔵 " + prefix + " info"], ["warn", "🟡 " + prefix + " warn"], ["error", "🔴 " + prefix + " error"]]);
});

Deno.test("File/Lines and Time (with debug level)", async () => {
  reset({ fileLine: true, icons: undefined, timeDiff: true });

  const log = hub("test");
  log.level = "debug";
  log.debug("debug");
  await delay(10);
  log.log("log");

  // Test validity
  const prefix = color("test", true);
  const fileLine = colors.underline(colors.white("[hub.test.ts:40]"));
  const time = BUFFER[0][2];
  assertEquals(BUFFER, [["debug", fileLine + " " + prefix + " debug", time]]);
  assertMatch(time, /\+\d+\.\d+ms/);
});

Deno.test("Time Measurements", async () => {
  reset({ compact: true });

  const log = hub("test");

  // Create a long array and print it in different ways
  log.info("one");
  await delay(5);
  log.info("two");
  await delay(3);
  log.info("three");

  const [_t1, t2, t3] = BUFFER.map((b) => parseInt(colors.stripAnsiCode(b[2])));
  assertGreaterOrEqual(t2, 5);
  assertLess(t2, 5 + 3);
  assertGreaterOrEqual(t3, 3);
  assertLess(t3, 3 + 3);
});

Deno.test("Logging Error Objects", () => {
  reset({ compact: true });

  const log = hub("test");

  try {
    throw new Error("This is an error");
  } catch (error) {
    log.error(error);
  }
});

Deno.test("Unique Instances", () => {
  reset({ compact: true });

  const log1 = hub("test");
  const log2 = hub("test");
  assertEquals(log1, log2);

  // Create a long array and print it in different ways
  log1.info("from 1");
  log2.info("from 2");
  assertEquals(BUFFER.length, 2);

  const log3 = hub("test");
  log3.level = "error";
  log1.warn("from 1");
  log2.error("from 2");
  assertEquals(BUFFER.length, 3);
});

Deno.test("Objects via inspect (one line)", () => {
  reset({ compact: true });

  const log = hub("test");
  log.level = "info";

  // Create a long array and print it in different ways
  const people = Array.from(Array(256).keys()).map((i) => ({ name: "Person " + i, age: i }));
  log.info("people: ", people);

  // Test validity (object should have been converted to string)
  assertEquals(BUFFER.length, 1);
  assertEquals(typeof BUFFER[0][2], "string");
  assertEquals((BUFFER[0][2] as string).indexOf("\n"), -1);
  assertEquals((BUFFER[0][2] as string).split("Person").length, 26);
});

Deno.test("Console Replacement", () => {
  reset();

  const ns = ":console:", prefix = color(ns, true);

  // Replace the native console (start)
  const original = console;
  // deno-lint-ignore no-global-assign
  console = hub(ns);

  // Test validity
  console.warn("warn");
  assertEquals(BUFFER, [["warn", "🟡 " + prefix + " warn", BUFFER[0][2]]]);

  // Test validity
  console.info("info");
  assertEquals(BUFFER, [["warn", "🟡 " + prefix + " warn", BUFFER[0][2]], ["info", "🔵 " + prefix + " info", BUFFER[1][2]]]);
  assertEquals(BUFFER.length, 2);

  // End the replacement
  // deno-lint-ignore no-global-assign
  console = original;

  // Test validity (buffer no longer increments)
  console.error("error");
  assertEquals(BUFFER.length, 2);
});

Deno.test("Turn off switch", () => {
  reset();

  const log = hub("test");

  // Before turning off
  log.info("1");
  assertEquals(BUFFER.length, 1);

  // After turning off
  configure("off", "*");
  log.info("2");
  assertEquals(BUFFER.length, 1);

  // After turning on
  configure("off", "");
  log.info("3");
  assertEquals(BUFFER.length, 2);
});

Deno.test("Globs", () => {
  reset();

  configure("debug", "f*");
  const log1 = hub("foo");
  const log2 = hub("bar");
  log1.debug("debug");
  log2.debug("debug");
  assertEquals(BUFFER.length, 1);
});
