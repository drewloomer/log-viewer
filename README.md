# `log-viewer`

A simple log viewer HTTP API and UI.

## Quickstart

Either install `pnpm` or `volta` locally first.

```sh
# install all packages
pnpm i

# run first time starting the dev server to generate mock logs and
# copy them to /var/log
pnpm dev:pre

# start the API and UI in dev mode
pnpm dev

# delete generated logs from /var/log
pnpm dev:post
```

## Architecture

This monorepo consists of two apps: `api` and `ui`. Each is located in the `apps` directory. It also contains a package, `logs`, to generate large mock logs to stress test the UI and API.

## `api`

An `express`-based REST API that loads logs from a given file name(s).

### Commands

```bash
# start the server
pnpm start

# start the server in watch mode
pnpm dev

# run unit tests
pnpm test:unit
```

### Endpoints

#### `GET /logs`

Get a list of logs for a given `fileName`(s).

| Query Param | Accepted Values                                              | Required? |
| ----------- | ------------------------------------------------------------ | --------- |
| `fileName`  | A file to query for logs.                                    | `true`    |
| `search`    | A query string to search for within logs.                    | `false`   |
| `offset`    | Return `limit` logs starting at `n`.                         | `false`   |
| `limit`     | How many logs to return. Defaults to `1000`. Max of `10000`. | `false`   |

```ts
{
  data: [{
    host: string;
    message: string;
    pid: string;
    process: number;
    timestamp: string; // ISO
  }],
  meta: {
    count: number;
    from: number | undefined;
    next: number | undefined;
    to: number | undefined;
  }
}
```

#### `GET /files`

Get a list of file names in `/var/logs` that can be queried.

```ts
{
  data: [{
    name: string;
    path: string;
    stats: Stats;
  }]
}
```

## `ui`

A simple React app for viewing log files, allowing those logs to be filtered by the parameters listed above.

## `logs`

Generates three log files in the `syslog` format: `small.log`, `medium.log`, and `large.log`. They are `10MB`, `100MB`, and `1GB`, respectively.

### Commands

```bash
# build the mock logs
pnpm build

# copy the logs to /var/log
pnpm copy

# remove the logs from /var/log
pnpm cleanup

# build the mock logs in watch mode (not very useful anymore!)
nodemon
```

## 💬 Thoughts on primary and secondary servers

I opted not to implement this because of time, and it seems like it would not only require API work but also a UI that can properly model the added complexity. I know it's not the same, but here is roughly how I'd do it:

### `agent` app

- Take the existing code in `api` and move it to an `agent` application that would run on each secondary machine
  - This code already does the basics for reading files and logs on a machine
- When the `express` server boots, have it phone home to the `api` app to register itself
  - It should also routinely report its status to the `api` so we can remove secondaries as they go offline

### `api` app

- Add `POST /agent` and `PUT /agent` endpoints for registering and and reporting agent health
- Update the `GET /files` endpoint to return a schema where files are grouped by the agent they live on
  - Make requests to each registered agent's `GET /files` endpoint in parallel, merging the results
  - If a request to an agent fails, mark it as offline and don't query it again until it updates it status
- Update the `GET /logs` endpoint to accept agent and filenames
  - Follow a similar parallel request pattern, but interleave the returned logs by their `timestamp`
  - Add a new field to the `Log` type to include which agent the log came from

### `ui` app

- Add a multi-select of available machines to query against
- Add the machine name to the log results

## 😞 Other shortcomings

Here are some additional things I'd do if I had more time:

- Testing
  - Write more unit tests
    - I wrote a few just to prove I know what I'm doing, but they certainly aren't exhaustive
    - I've outlined what I would want to test at the unit level in `test.todo` entries
  - Write integration tests via [`supertest`](https://www.npmjs.com/package/supertest)
    - These would focus on exercising the REST endpoints of the `api` app
    - Use the mocked logs to allow these tests to be run consistently on any platform
  - Write end-to-end tests via [`playwright`](https://www.playwright.dev)
    - These would be limited and focus on happy path scenarios of data flowing through the whole system
  - Write component/unit tests for the `ui`
    - This code is totally untested! 😵‍💫
    - These would focus on the inputs/outputs of components and how the hooks work
- Performance
  - There are _lots_ of opportunities for caching on both the UI and the API
- Error handling
  - This code, on both the back and frontends, is not very fault tolerant
- CI/CD
  - At least introduce some basic `main` branch protections that require tests to pass

## Todo

- [x] Generate mock logs
- [x] Return a list of valid log files
- [x] Return log contents by `fileName`
- [x] Handle no file found
- [x] Return logs contents by comma-separated `fileName` values
- [x] Break syslog entry into object for return
- [x] Allow for `offset`
- [x] Allow for variable `limit`
- [x] Filter logs by `search`
- [x] Scaffold UI
- [x] Query `GET /logs` on page load
- [x] Add search box
- [x] Re-query `GET /logs` when filters change
- [x] Add forward pagination

# Project Brief

## Problem statement

A customer has asked you for a way to provide on-demand monitoring of various unix-based servers without having to log into each individual machine and opening up the log files found in /var/log. The customer has asked for the ability to issue a REST request to a machine in order to retrieve logs from /var/log on the machine receiving the REST request.

## Acceptance criteria:

1. A README file describing how to run and use the service.
2. An HTTP REST API exposing at least one endpoint that can return the lines
   requested from a given log file.
3. The lines returned must be presented with the newest log events first. It is safe to
   assume that log files will be written with newest events at the end of the file.
4. The REST API should support additional query parameters which include
   a. The ability to specify a filename within /var/log
   b. The ability to filter results based on basic text/keyword matches
   c. The ability to specify the last n number of matching entries to retrieve
   within the log
5. The service should work and be reasonable performant when requesting files of
   \> 1GB
6. Minimize the number of external dependencies in the business logic code path. For example, if implementing your project with Node.js:
   a. Feel free to use Express or similar as the HTTP server as well as any of the built-in Node.js modules like fs.
   b. Please do not use external libraries for any file reads or working with the log lines after you’ve read them. We want to see your solution in this case using only what Node.js has built-in.

## Bonus points

If you finish the project early and want to add a little bit of polish, feel free to implement a basic UI to interact with the API. This can make it a bit easier for you to demo your project to us when the time comes, but isn’t required for a complete submission (we’re just as happy using curl/Postman/etc. to interact with the API).

## Only if you really want to

If you finish the assignment early and want to challenge yourself with a bit more, there’s one additional feature you could add. Working on this part in no way affects the scoring of the project, but if you decide you want to do it anyway, it may lead to some interesting discussions during the next interview phase.

Add the ability to issue a REST request to one “primary” server which subsequently requests those logs from a list of “secondary” servers. There aren’t any hard requirements for the protocol used between the primary and secondary servers, and the architecture is completely up to you.
