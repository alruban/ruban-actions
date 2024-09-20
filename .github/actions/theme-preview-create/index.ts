import { resolve } from "node:path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  createTheme,
  getStoreThemes,
  logStep,
  createGitHubComment,
} from "../../../lib/utils";

let timeout;

async function runAction() {
  if (!process.env.SHOPIFY_FLAG_PATH)
    throw new Error("Missing [SHOPIFY_FLAG_PATH] environment variable");
  if (!process.env.SHOPIFY_FLAG_STORE)
    throw new Error("Missing [SHOPIFY_FLAG_STORE] environment variable");
  if (!process.env.SHOPIFY_CLI_THEME_TOKEN)
    throw new Error("Missing [SHOPIFY_CLI_THEME_TOKEN] environment variable");

  const themeName = `MTTD/Preview - ${process.env.GITHUB_HEAD_REF}`;

  logStep("Check if preview theme already exists");
  const allThemes = await getStoreThemes({
    shop: process.env.SHOPIFY_FLAG_STORE,
    password: process.env.SHOPIFY_CLI_THEME_TOKEN,
  });

  let previewTheme = allThemes.find((t) => t.name === themeName);
  const ignoredPushFiles =
    core
      .getInput("IGNORED_FILES_PUSH")
      .split(" ")
      .map((pattern) => pattern && `--ignore=${pattern}`)
      .filter(Boolean) ?? [];
  const ignoredPullFiles =
    core
      .getInput("IGNORED_FILES_PULL")
      .split(" ")
      .map((pattern) => pattern && `--ignore=${pattern}`)
      .filter(Boolean) ?? [];

  core.debug(
    JSON.stringify({
      ignoredFiles: {
        ignoredPullFiles: ignoredPullFiles,
        ignoredPushFiles: ignoredPushFiles,
      },
    })
  );

  if (!previewTheme) {
    logStep("Preview theme not found, creating new theme");
    previewTheme = await createTheme({
      shop: process.env.SHOPIFY_FLAG_STORE,
      password: process.env.SHOPIFY_CLI_THEME_TOKEN,
      themeName,
    });

    const tmpRoot = resolve(
      process.env.SHOPIFY_FLAG_PATH,
      "../dist-live-theme"
    );

    logStep("Live sync: Pull");
    await exec.exec(`pnpm shopify theme pull`, [
      "--live",
      "--only=sections/*",
      "--only=templates/*",
      "--only=*/*.json",
      `--path=${tmpRoot}`,
      ...ignoredPullFiles,
    ]);

    timeout = setTimeout(() => {
      throw new Error("Shopify's push action took too long, aborting.");
    }, 1000 * 60 * 5); // 5 mins

    logStep("Live sync: Push");
    await exec.exec(`pnpm shopify theme push`, [
      "--nodelete",
      `--path=${tmpRoot}`,
      `--theme=${previewTheme.id}`,
    ]);
  }

  clearTimeout(timeout);

  timeout = setTimeout(() => {
    throw new Error("Shopify's push action took too long, aborting.");
  }, 1000 * 60 * 5); // 5 mins

  logStep("Update preview theme");
  await exec.exec(`pnpm shopify theme push`, [
    `--nodelete`,
    `--theme=${previewTheme.id}`,
    "--ignore=config/settings_data.json",
    ...ignoredPushFiles,
  ]);

  clearTimeout(timeout);

  logStep("Create github comment");
  await createGitHubComment(previewTheme.id);
}

// Execute

try {
  runAction();
} catch (error) {
  core.setFailed(error);
}
