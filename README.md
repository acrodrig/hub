# Hub

## Overview
Hub is a lightweight and opinionated logging utility designed as a spiritual successor to [debug-js](https://github.com/debug-js/debug). It simplifies logging by wrapping the `console` object and supports multiple logging levels. This tool is useful for debugging applications without the overhead of managing different console statements manually.

## Features
- **Multiple Logging Levels**: Supports `debug`, `info`, `warn`, `error`, `off`, and `log`.
- **Namespace Support**: Enables logging based on environment variables.
- **Color-Coded Output**: Uses distinct colors to differentiate log messages.
- **Icons for Readability**: Adds relevant icons to log messages.
- **Buffering for Testing**: Logs can be buffered and later reviewed.
- **Performance Marking**: Measures execution time between log statements.
- **Minimalistic and Lightweight**: No dependencies beyond standard libraries.

## Differences from debug-js
- Does **not** support the `inspect` option.
- Works across all log levels, not just `debug`.
- Uses only the `:` separator for namespacing.

## Installation
This project is built for use with Deno, ensuring compatibility with modern JavaScript/TypeScript applications.

```sh
import { hub, setup } from "./hub.ts";
```

## Usage

### Basic Usage
Create a logger instance for a specific namespace:

```typescript
const logger = hub("myNamespace");
logger.info("This is an info message");
logger.debug("This is a debug message");
logger.error("Something went wrong");
```

### Logging Levels
You can define the logging level to control verbosity:

```typescript
const logger = hub("myNamespace", "warn");
logger.info("This won't be printed");
logger.warn("This will be printed");
```

### Overriding Console.log
If you want `hub` to handle `console.log`, you can enable it explicitly:

```typescript
const logger = hub("myNamespace", "debug", true);
logger.log("This message will go through hub");
```

### Using Environment Variables
To enable or disable loggers dynamically, set the `DEBUG` environment variable:

```sh
export DEBUG="myNamespace" # Enables logging for 'myNamespace'
export DEBUG="*"           # Enables logging for all namespaces
```

### Buffering Logs (for Testing)
Hub includes an internal buffer for testing scenarios:

```typescript
import { DEFAULTS } from "./hub.ts";
DEFAULTS.buffer = [];
const logger = hub("testLogger");
logger.info("Testing buffered log");
console.log(DEFAULTS.buffer); // View stored logs
```

## API Reference

### `hub(ns: string, level?: string, logAlso?: boolean) => Console`
Creates a namespaced logger.

- `ns`: The namespace for the logger.
- `level` _(optional)_: The log level (`debug`, `info`, `warn`, `error`, `off`). Defaults to `info`.
- `logAlso` _(optional)_: If `true`, will replace `console.log` behavior.

**Returns**: A console-like object with additional functionalities.

### `setup(debug?: string) => void`
Configures logging based on the `DEBUG` environment variable.

- `debug`: A comma or space-separated list of enabled namespaces.

## Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -m "Added a new feature"`).
4. Push the branch (`git push origin feature-branch`).
5. Open a Pull Request.

## License
This project is open-source and available under the MIT License.

