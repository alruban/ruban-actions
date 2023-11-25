# alruban/theme-preview-create

[About this repo](#about-this-repo) | [Usage](#usage) | [Configuration](#configuration)

## About this repo

Create preview theme on Pull Requests using GitHub Actions.

## Usage

```yml
- uses: alruban/shopify-actions/.github/workflows/theme-preview-create.yml@main
  secrets:
    PASSWORD: ${{ secrets.PASSWORD }}
    SHOP: ${{ secrets.SHOP }}
    IGNORED_FILES: ${{ secrets.IGNORED_FILES }}
```

## Configuration

The `alruban/theme-preview-create` accepts the following arguments:

- `PASSWORD` - (required) The Shopify store's private app password.
- `SHOP` - (required) The shopify development store i.e. `my-store.myshopify.com`
- `IGNORED_FILES` - (optional) List of files to ignore
