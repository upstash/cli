# Upstash CLI

Manage Upstash resources in your terminal or CI.

![](./img/banner.svg)

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/upstash/cli)
[![Downloads/week](https://img.shields.io/npm/dw/lstr.svg)](https://npmjs.org/package/@upstash/cli)

# Installation

## npm

You can install upstash's cli directly from npm

```bash
npm i -g @upstash/cli
```

It will be added as `upstash` to your system's path.

## Compiled binaries:

`upstash` is also available from the
[releases page](https://github.com/upstash/upstash-cli/releases/latest) compiled
for windows, linux and mac (both intel and m1).

# Usage

```bash
> upstash

  Usage:   upstash    
  Version: development

  Description:

    Official cli for Upstash products

  Options:

    -h, --help               - Show this help.                                                                           
    -V, --version            - Show the version number for this program.                                                 
    -c, --config   <string>  - Path to .upstash.json file

  Commands:

    auth   - Login and logout                   
    redis  - Manage redis database instances    
    kafka  - Manage kafka clusters and topics   
    team   - Manage your teams and their members

  Environment variables:

    UPSTASH_EMAIL    <string>  - The email you use on upstash
    UPSTASH_API_KEY  <string>  - The api key from upstash
```

## Authentication

When running `upstash` for the first time, you should log in using
`upstash auth login`. Provide your email and an api key.
[See here for how to get a key.](https://docs.upstash.com/redis/howto/developerapi#api-development)

As an alternative to logging in, you can provide `UPSTASH_EMAIL` and
`UPSTASH_API_KEY` as environment variables.

## Usage

Let's create a new redis database:

```
> upstash redis create --name=my-db --region=eu-west-1
  Database has been created

  database_id          a3e25299-132a-45b9-b026-c73f5a807859
  database_name        my-db
  database_type        Pay as You Go
  region               eu-west-1
  type                 paid
  port                 37090
  creation_time        1652687630
  state                active
  password             88ae6392a1084d1186a3da37fb5f5a30
  user_email           andreas@upstash.com
  endpoint             eu1-magnetic-lacewing-37090.upstash.io
  edge                 false
  multizone            false
  rest_token           AZDiASQgYTNlMjUyOTktMTMyYS00NWI5LWIwMjYtYzczZjVhODA3ODU5ODhhZTYzOTJhMTA4NGQxMTg2YTNkYTM3ZmI1ZjVhMzA=
  read_only_rest_token ApDiASQgYTNlMjUyOTktMTMyYS00NWI5LWIwMjYtYzczZjVhODA3ODU5O_InFjRVX1XHsaSjq1wSerFCugZ8t8O1aTfbF6Jhq1I=


  You can visit your database details page: https://console.upstash.com/redis/a3e25299-132a-45b9-b026-c73f5a807859

  Connect to your database with redis-cli: redis-cli -u redis://88ae6392a1084d1186a3da37fb5f5a30@eu1-magnetic-lacewing-37090.upstash.io:37090
```

## Output

Most commands support the `--json` flag to return the raw api response as json,
which you can parse and automate your system.

```bash
> upstash  redis create --name=test2113 --region=us-central1 --json | jq '.endpoint'

 "gusc1-clean-gelding-30208.upstash.io"
```

## Contributing

If anything feels wrong, you discover a bug or want to request improvements,
please create an issue or talk to us on
[Discord](https://discord.com/invite/w9SenAtbme)
