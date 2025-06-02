#!/usr/bin/env -S deno test -A

import { assertEquals } from "@std/assert";
import { BUFFER, configure, DEFAULTS, hub } from "../src/hub.ts";
import { assertStringIncludes } from "@std/assert/string-includes";

const FILENAME = import.meta.filename?.split("/").pop()!;
const original = console;

DEFAULTS.buffer = true;

Deno.test("Replace Original Console", () => {
  BUFFER.length = 0;

  // Fake setting DEBUG env variable to "*"
  configure("debug", "*");

  // deno-lint-ignore no-global-assign
  console = hub("*");

  // Will call console.debug which has been replaced and console.log which has not
  console.debug("debug");
  console.log("log");
  assertEquals(BUFFER.length, 1);
  assertEquals(BUFFER[0][0], "debug");
  assertStringIncludes(BUFFER[0][1], FILENAME);

  // deno-lint-ignore no-global-assign
  console = original;
});

Deno.test("Include log in Replacement", () => {
  BUFFER.length = 0;

  // Fake setting INFO env variable to "*"
  configure("info", "*");

  // deno-lint-ignore no-global-assign
  console = hub("*", { includeLog: true }, true);

  // First call will be a no-op, but second will be included
  console.debug("debug");
  console.log("log");
  assertEquals(BUFFER.length, 1);
  assertEquals(BUFFER[0][0], "log");
  assertStringIncludes(BUFFER[0][1], FILENAME);

  // deno-lint-ignore no-global-assign
  console = original;
});

Deno.test("Global Console", () => {
  BUFFER.length = 0;

  // Declare a 'test' namespace on parent dir
  hub("test", { buffer: true, root: import.meta.dirname + "/../" });

  // deno-lint-ignore no-global-assign
  console = hub("*");

  console.debug("debug");
  console.info("info");
  console.warn("warn");
  console.log("log");

  assertEquals(BUFFER.length, 2);
  assertEquals(BUFFER[0][0], "info");
  assertEquals(BUFFER[1][0], "warn");
});
