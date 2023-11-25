# alruban/theme-deploy-action

[About this repo](#about-this-repo) | [Usage](#usage) | [Configuration](#configuration)

## About this repo

Deploy Shopify theme using GitHub Actions.

## Usage

```yml
- uses: alruban/shopify-actions/.github/actions/theme-deploy@main
  with:
    SHOPIFY_PASSWORD: ${{ secrets.PASSWORD }}
    SHOPIFY_SHOP: ${{ secrets.SHOP }}
    SHOPIFY_THEME_ID: ${{ secrets.THEME_ID }}
```

## Configuration

The `alruban/theme-deploy-action` accepts the following arguments:

- `SHOPIFY_PASSWORD` - (required) The Shopify store's private app password.
- `SHOPIFY_SHOP` - (required) The shopify development store i.e. `my-store.myshopify.com`.
- `SHOPIFY_THEME_ID` - (required) The Shopify store's theme id.
