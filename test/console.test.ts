#!/usr/bin/env -S deno test -A

import { assertEquals } from "@std/assert";
import { BUFFER, CONSOLE, DEFAULTS, hub, ROOT } from "../src/hub.ts";
import { assertStringIncludes } from "@std/assert/string-includes";

const FILENAME = import.meta.filename?.split("/").pop()!;

// deno-lint-ignore no-explicit-any
(DEFAULTS as any).buffer = true;

Deno.test("Replace Original Console", () => {
  BUFFER.length = 0;

  // Fake setting HUB env variable to "debug"
  Deno.env.set("HUB", "debug");
  // deno-lint-ignore no-global-assign
  console = hub("*", "debug");
  console.debug("debug");
  console.log("log");
  assertEquals(BUFFER.length, 1);
  assertEquals(BUFFER[0][0], "debug");
  assertStringIncludes(BUFFER[0][1], FILENAME);
  // deno-lint-ignore no-global-assign
  console = CONSOLE;
  Deno.env.delete("HUB");
});

Deno.test("Include log in Replacement", () => {
  BUFFER.length = 0;

  // Fake setting HUB env variable to "log"
  Deno.env.set("HUB", "log");
  // deno-lint-ignore no-global-assign
  console = hub("*", "log", {}, true);
  console.debug("debug");
  console.log("log");
  assertEquals(BUFFER.length, 1);
  assertEquals(BUFFER[0][0], "log");
  assertStringIncludes(BUFFER[0][1], FILENAME);
  // deno-lint-ignore no-global-assign
  console = CONSOLE;
  Deno.env.delete("HUB");
});

Deno.test("Global Console", () => {
  // Declare a 'test' namespace on parent dir
  hub("test", "info", { buffer: true, root: import.meta.dirname + "/../" });

  BUFFER.length = 0;
  // deno-lint-ignore no-global-assign
  console = ROOT;

  console.debug("debug");
  console.info("info");
  console.warn("warn");
  console.log("log");

  assertEquals(BUFFER.length, 2);
  assertEquals(BUFFER[0][0], "info");
  assertEquals(BUFFER[1][0], "warn");
});
