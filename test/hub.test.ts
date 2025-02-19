#!/usr/bin/env -S deno test -A

import { assertEquals, assertGreaterOrEqual, assertLess, assertMatch } from "@std/assert";
import { delay } from "jsr:@std/async";
import * as colors from "@std/fmt/colors";
import { color, CONSOLE, hub, setup } from "../src/hub.ts";

// We set a buffer to capture console.log messages
const buffer = [] as string[][];
const reset = (options: Record<string, unknown> = {}) => {
  buffer.length = 0;
  const defaults = { buffer, compact: true, defaultLevel: "info", fileLine: false, icons: true, time: true };
  setup(Object.assign({}, defaults, options));
};

Deno.test("Basic", () => {
  reset({ fileLine: false, icons: true, time: false });

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
  reset({ fileLine: true, icons: false, time: true });

  const log = hub("test", "debug");

  log.debug("debug");
  await delay(10);
  log.log("log");

  // Test validity
  const prefix = color("test", true);
  const fileLine = colors.underline(colors.white("[hub.test.ts:38]"));
  const time = buffer[0][1][1];
  assertEquals(buffer, [["debug", [fileLine + " " + prefix + " debug", buffer[0][1][1]]]]);
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

  const [_t1, t2, t3] = buffer.map((b) => parseInt(colors.stripAnsiCode(b[1][1])));
  assertGreaterOrEqual(t2, 5);
  assertLess(t2, 5 + 2);
  assertGreaterOrEqual(t3, 3);
  assertLess(t3, 3 + 2);
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
  assertEquals(buffer.length, 2);

  const _log3 = hub("test", "error");
  log1.warn("from 1");
  log2.error("from 2");
  assertEquals(buffer.length, 3);
});

Deno.test("Objects via inspect (one line)", () => {
  reset({ compact: true });

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
  reset();

  const ns = ":console:", prefix = color(ns, true);

  // Replace the native console (start)
  // deno-lint-ignore no-global-assign
  console = hub(ns);

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
  reset();

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
