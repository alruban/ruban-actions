# alruban/theme-preview-delete

[About this repo](#about-this-repo) | [Usage](#usage) | [Configuration](#configuration)

## About this repo

Delete preview theme using GitHub Actions.

## Usage

```yml
- uses: alruban/shopify-actions/.github/actions/theme-preview-delete@main
  with:
    SHOPIFY_PASSWORD: { your_app_password }
    SHOPIFY_SHOP: { your_shop }
```

## Configuration

The `alruban/theme-preview-delete` accepts the following arguments:

- `SHOPIFY_PASSWORD` - (required) The Shopify store's private app password.
- `SHOPIFY_SHOP` - (required) The shopify development store i.e. `my-store.myshopify.com`
