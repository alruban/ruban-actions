# alruban/cache-and-install-action

[About this repo](#about-this-repo) | [Usage](#usage) | [Configuration](#configuration)

## About this repo

Cache and install, optionally generates production build.

## Usage

```yml
- name: "Cache and install"
  uses: alruban/shopify-actions/.github/actions/cache-and-install@main
  with:
    build: true # optional, defaults to `false`
```

## Configuration

The `alruban/cache-and-install-action` accepts the following arguments:

- `build` - (optional, default: `false`) Generate production build
