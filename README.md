# Hub

## Overview

Hub is a lightweight and opinionated logging utility plus a spiritual successor
to [debug-js](https://github.com/debug-js/debug). It simplifies logging by (
potentially) wrapping the `console` object and
supports multiple logging levels.

## Use

You use the `DEBUG` environment variable, just as you would
with [debug-js](https://github.com/debug-js/debug). The other levels (i.e.
`INFO`, `WARN`, `ERROR` and `OFF`) are also available.

Simplest use from command line:

```bash
DEBUG="pkg1,pkg3/sub*" WARN="pkg2*" node app.js
```

Which will set the `pkg1` and all logs namespaces starting with `pkg3/sub`
namespaces to `debug` level and all namespaces starting with `pkg2` to `warn`
level. Each environment variable is a comma separated list of globs. Default
level is always `info`.

## Motivation

We have a perfectly good logger in [`console`](mdn link), however, we do not use
it
because the standard forgot to add a way to set the level. So `console.debug` is
useless, as it is equivalent to `console.log`. Hub changes that by
retrofitting the `debug`, `info`, `warn` and `error` methods in `console`
(and not touching anything else).

It also adds a filename, colors and time since the last invocation to the log.
All these are features also found in [debug](...).

You can use the `console` object throughout the code and then add a
namespace that matches a base path (or let Hub autodiscover it based on the
`deno.json` file), which
performs the magic of retrofitting the `console` object and making it a
namespaced log. You can, of course, use "logs" throughout your code without
touch the native console object.

## Examples

### Simple Logging

Create a logger instance for a specific namespace:

```typescript
const log = hub("pkg"); // Without any enviroment variable, level is 'info'

// Log at different levels
log.info("This is an info message");
log.debug("This is a debug message"); // Will not print
log.error("Something went wrong");

// Change log level
log.level = "debug";
log.debug("This is a debug message"); // This one will print!
```

### Turn off completely

Sometimes you do not want to see logs, you can set the `off` level as:

```bash
OFF="*" WARN="pkg2*" node app.js
```

Note that the `OFF` level will have priority as it is higher.

### Set namespaces

If you want to set a namespace for an entire package (or sub-directory) you 
can do:

```typescript
hub("pkg", { root: import.meta.dirname });
```

The previous will make sure that all files under that root share the same 
namespace.

## Features

- **Logging Level**: sets logging levels for `console`
- **Filename and Line**: how many times have you forgotten where you added 
  that printout statement?
- **Namespace**: either manual or automatic (in Deno) namespace per module
- **Control via Environment**: useful to turn on/off in different environments
- **Time**: prints time taken between printouts
- **Color**: per namespace/log, useful for debugging

## Wny not X?

- **Console**: lack of levels
- **Consola**: does not do filename and clean namespaces
- **pino**: large dependency tree, commitment to structure


## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -m "Added a new feature"`).
4. Push the branch (`git push origin feature-branch`).
5. Open a Pull Request.

## License

This project is open-source and available under the MIT License.
