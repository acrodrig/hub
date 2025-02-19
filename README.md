# Hub

## Overview
Hub is a lightweight and opinionated logging utility plus a spiritual successor 
to [debug-js](https://github.com/debug-js/debug). It simplifies logging by 
wrapping the `console` object and supports multiple logging levels. This tool is 
useful for debugging applications without the overhead of managing different 
console statements manually.

## Features
- **Multiple Logging Levels**: Supports `debug`, `info`, `warn`, `error`
- **Namespace Support**: Enables DEBUG logging based on environment variables.
- **Color-Coded Output**: Uses distinct colors to differentiate log messages.
- **Icons for Readability**: Adds relevant icons (i.e. emojis) to log messages.
- **File names and Lines**: Prints fil/line so that you stop wondering where printout comes from
- **Performance Marking**: Measures sub-millisecond execution time between log statements.
- **Minimalistic and Lightweight**: No dependencies beyond standard libraries.

## Differences from debug-js
- Works across all log levels, not just `debug`.
- Does not have wildcards for simplicity

## Installation
This project is built for use with Deno, ensuring compatibility with modern JavaScript/TypeScript applications.

```sh
import { hub, setup } from "./hub.ts";
```

## Usage

### Basic Usage
Create a logger instance for a specific namespace:

```typescript
const log = hub("myNamespace");
log.info("This is an info message");
log.debug("This is a debug message");
log.error("Something went wrong");
```

### Logging Levels
You can define the logging level to control verbosity:

```typescript
const log = hub("myNamespace", "warn");
log.info("This won't be printed");
log.warn("This will be printed");
```

### Overriding Console.log
If you want `hub` to handle `console.log`, you can enable it explicitly:

```typescript
const log = hub("myNamespace", "debug", true);
log.log("This message will go through hub");
```

### Using Environment Variables
To enable or disable loggers dynamically, set the `DEBUG` environment variable:

```sh
export DEBUG="myNamespace" # Enables logging for 'myNamespace'
export DEBUG="*"           # Enables logging for all namespaces
```

### Buffering Logs (for Testing)
Hub includes an internal buffer for testing scenarios. It will throw after a 1000 lines have been accumulated.

```typescript
import { DEFAULTS } from "./hub.ts";
DEFAULTS.buffer = [];
const log = hub("testLogger");
log.info("Testing buffered log");
console.log(DEFAULTS.buffer); // View stored logs
```

## Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -m "Added a new feature"`).
4. Push the branch (`git push origin feature-branch`).
5. Open a Pull Request.

## License

This project is open-source and available under the MIT License.
