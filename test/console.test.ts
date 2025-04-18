#!/usr/bin/env -S deno test -A

import { console } from "../mod.ts#test";

// Not a test perse, but just a test to see if the console replacement works

Deno.test("Replacement Console", () => {
  console.debug("debug");
  console.info("info");
  console.warn("warn");
  console.error("error");
  console.log("log");
});
