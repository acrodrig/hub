#!/usr/bin/env -S deno test -A

import { assertEquals, assertGreaterOrEqual, assertLess, assertMatch } from "@std/assert";
import { delay } from "jsr:@std/async";
import * as colors from "@std/fmt/colors";
import { color, CONSOLE, DEFAULTS, hub } from "../src/hub.ts";

// We set a buffer to capture console.log messages
const buffer = DEFAULTS.buffer = [];
const reset = { ...DEFAULTS };

Deno.test("Basic", () => {
  buffer.length = 0;
  Object.assign(DEFAULTS, reset, { fileLine: false, icons: true, time: false });

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
});

Deno.test("File/Lines and Time (with debug level)", async () => {
  buffer.length = 0;
  Object.assign(DEFAULTS, reset, { fileLine: true, icons: false, time: true });

  const log = hub("test", "debug");

  log.debug("debug");
  await delay(10);
  log.log("log");

  // Test validity
  const prefix = color("test", true);
  const fileLine = colors.underline(colors.white("[hub.test.ts:36]"));
  const time = buffer[0][1][1];
  assertEquals(buffer, [["debug", [fileLine + " " + prefix + " debug", buffer[0][1][1]]]]);
  assertMatch(time, /\+\d+\.\d+ms/);
});

Deno.test("Time Measurements", async () => {
  buffer.length = 0;
  Object.assign(DEFAULTS, reset, { compact: true });

  const log = hub("test");

  // Create a long array and print it in different ways
  log.info("one");
  await delay(5);
  log.info("two");
  await delay(3);
  log.info("three");

  const [_t1, t2, t3] = buffer.map((b) => parseInt(colors.stripAnsiCode(b[1][1])));
  assertGreaterOrEqual(t2, 5);
  assertLess(t2, 5 + 2);
  assertGreaterOrEqual(t3, 3);
  assertLess(t3, 3 + 2);
});

Deno.test("Objects via inspect (one line)", () => {
  buffer.length = 0;
  Object.assign(DEFAULTS, reset, { compact: true });

  const log = hub("test", "debug");

  // Create a long array and print it in different ways
  const people = Array.from(Array(256).keys()).map((i) => ({ name: "Person " + i, age: i }));
  log.info("people: ", people);

  // Test validity (object should have been converted to string)
  assertEquals(buffer.length, 1);
  assertEquals(typeof buffer[0][1][1], "string");
  assertEquals((buffer[0][1][1] as string).indexOf("\n"), -1);
  assertEquals((buffer[0][1][1] as string).split("Person").length, 26);
});

Deno.test("Console Replacement", () => {
  buffer.length = 0;
  const ns = ":console:", prefix = color(ns, true);

  // Replace the native console (start)
  // deno-lint-ignore no-global-assign
  console = hub(ns, undefined);

  // Test validity
  console.warn("warn");
  assertEquals(buffer, [["warn", ["🟡 " + prefix + " warn", buffer[0][1][1]]]]);

  // Test validity
  console.info("info");
  assertEquals(buffer, [["warn", ["🟡 " + prefix + " warn", buffer[0][1][1]]], ["info", ["🔵 " + prefix + " info", buffer[1][1][1]]]]);
  assertEquals(buffer.length, 2);

  // End the replacement
  // deno-lint-ignore no-global-assign
  console = CONSOLE;

  // Test validity (buffer no longer increments)
  console.error("error");
  assertEquals(buffer.length, 2);
});

Deno.test("On/Off switch", () => {
  buffer.length = 0;
  const log = hub("test");

  // Before turning off
  log.debug("1");
  assertEquals(buffer.length, 1);

  // After turning off
  hub(false);
  log.debug("2");
  assertEquals(buffer.length, 1);

  // After turning on
  hub(true);
  log.debug("3");
  assertEquals(buffer.length, 2);
});
