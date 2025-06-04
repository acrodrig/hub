#!/usr/bin/env -S deno test -A

import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";
import { stripVTControlCharacters as clean } from "node:util";
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

  // Remove debug for all setting
  configure("debug", undefined);
});

Deno.test("Global Console", () => {
  BUFFER.length = 0;

  // Declare a 'test' namespace on parent dir
  hub("test", { buffer: true, root: resolve(import.meta.dirname + "/../") });

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

Deno.test("External Module Namespace", async () => {
  BUFFER.length = 0;

  const gists = "https://gist.githubusercontent.com/";
  const url = gists + "acrodrig/781716a9cbf4b02785d13d59697b208a/raw/db2739a22f6a31860a102485f2a345e62d00f644/hub-external-test.ts";

  // deno-lint-ignore no-global-assign
  console = hub("*");

  // Declare a namespace for all gists
  hub("gists", { root: gists });

  // creates a logger for <namespace> `test`
  const gist = await import(url);
  gist.hello("world");

  assertEquals(BUFFER.length, 1);
  assertEquals(BUFFER[0][0], "info");
  assertEquals(clean(BUFFER[0][1]), "🔵 [hub-external-test.ts:2] gists Hello world!");
});
