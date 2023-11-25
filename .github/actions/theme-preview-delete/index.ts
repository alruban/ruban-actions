import * as core from "@actions/core";
import { deleteTheme, getStoreThemes, logStep } from "../../../lib/utils";

async function runAction() {
  if (!process.env.SHOPIFY_FLAG_STORE)
    throw new Error("Missing [SHOPIFY_FLAG_STORE] environment variable");
  if (!process.env.SHOPIFY_CLI_THEME_TOKEN)
    throw new Error("Missing [SHOPIFY_CLI_THEME_TOKEN] environment variable");

  const themeName = `MTTD/Preview - ${process.env.GITHUB_HEAD_REF}`;

  logStep("Retrieve preview theme id");
  const allThemes = await getStoreThemes({
    shop: process.env.SHOPIFY_FLAG_STORE,
    password: process.env.SHOPIFY_CLI_THEME_TOKEN,
  });

  const previewTheme = allThemes.find((t) => t.name === themeName);

  if (!previewTheme) {
    core.notice(`Preview theme [${themeName}] not found. Skipping.`);
    return;
  }

  logStep("Deleting preview theme");
  await deleteTheme({
    shop: process.env.SHOPIFY_FLAG_STORE,
    password: process.env.SHOPIFY_CLI_THEME_TOKEN,
    themeId: previewTheme.id,
  });
  core.info(`Preview theme [${themeName}] has been deleted`);
}

// Execute

try {
  runAction();
} catch (error) {
  core.setFailed(error);
}
