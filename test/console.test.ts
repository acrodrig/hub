#!/usr/bin/env -S deno test -A

import { hub } from "../src/hub.ts";

// Not a test perse, but just a test to see if the console replacement works
const console = hub("test", "debug");

Deno.test("Replacement Console", () => {
  console.debug("debug");
  console.info("info");
  console.warn("warn");
  console.error("error");
  console.log("log");
});

Deno.test("Global Console", () => {
  const log = hub("test", "debug");
  log.debug("debug");
  log.info("info");
  log.warn("warn");
  log.error("error");
  console.log("log");
});
