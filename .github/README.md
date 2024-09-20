# Alruban

[About this repo](#about-this-repo) | [Workflows](#workflows)

## About this repo

TODO

## Workflows

- Preview worfklow
  Requires `SHOPIFY_PREVIEW` repository variable to be created.

  ```toml
  store = "store-one.myshopify.com"
  password = "SECRET_PASSWORD"
  ```

- Deployment worfklows
  Require repository variables `SHOPIFY_PRODUCTION` and `SHOPIFY_STAGING` for production and staging branches, respectively.

  ```toml
  [store_one]
  store = "store-one.myshopify.com"
  theme_id = "1234567890"
  password = "STORE_ONE_PASSWORD"

  [store_two]
  store = "store-two.myshopify.com"
  theme_id = "1234567890"
  password = "STORE_TWO_PASSWORD"
  ```

```

Config for deployment can contain one or more stores.

**NOTE**: `password` field must be a name of the secret containing theme access password.
```
