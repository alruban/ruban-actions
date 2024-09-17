import { resolve } from "node:path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  createTheme,
  getStoreThemes,
  logStep,
  createGitHubComment,
  deleteTheme,
} from "../../../lib/utils";

async function runAction() {
  if (!process.env.SHOPIFY_FLAG_PATH)
    throw new Error("Missing [SHOPIFY_FLAG_PATH] environment variable");
  if (!process.env.SHOPIFY_FLAG_STORE)
    throw new Error("Missing [SHOPIFY_FLAG_STORE] environment variable");
  if (!process.env.SHOPIFY_CLI_THEME_TOKEN)
    throw new Error("Missing [SHOPIFY_CLI_THEME_TOKEN] environment variable");

  const isStaging = process.env.GITHUB_HEAD_REF === "staging";

  const themeName = isStaging
    ? "ALRUBAN/Preprod"
    : `ALRUBAN/Preview - ${process.env.GITHUB_HEAD_REF}`;

  logStep("Check if preview theme already exists");
  const allThemes = await getStoreThemes({
    shop: process.env.SHOPIFY_FLAG_STORE,
    password: process.env.SHOPIFY_CLI_THEME_TOKEN,
  });
  let previewTheme = allThemes.find((t) => t.name.startsWith(themeName));

  if (!previewTheme) {
    logStep("Creating new theme");
    previewTheme = await createTheme({
      shop: process.env.SHOPIFY_FLAG_STORE,
      password: process.env.SHOPIFY_CLI_THEME_TOKEN,
      themeName,
    });
    console.log(previewTheme);

    try {
      const tmpRoot = resolve(
        process.env.SHOPIFY_FLAG_PATH,
        "../dist-live-theme"
      );

      logStep("Live sync: Pull");
      await exec.exec(`shopify theme pull`, [
        "--stable",
        process.env.SHOPIFY_SYNC_THEME_ID
          ? `--theme=${process.env.SHOPIFY_SYNC_THEME_ID}`
          : "--live",
        ...(isStaging
          ? [
              // download whole theme
            ]
          : [
              "--only=layout/*",
              "--only=sections/*",
              "--only=snippets/*",
              "--only=templates/*",
              "--only=*/*.json",
              // Ignore translation related templates
              "--ignore=*.context.*",
            ]),
        `--path=${tmpRoot}`,
      ]);

      logStep("Live sync: Push");
      await exec.exec(`shopify theme push`, [
        "--stable",
        "--nodelete",
        `--path=${tmpRoot}`,
        `--theme=${previewTheme.id}`,
      ]);
    } catch (error) {
      logStep("Unable to sync live theme, deleting preview theme");
      await deleteTheme({
        shop: process.env.SHOPIFY_FLAG_STORE,
        password: process.env.SHOPIFY_CLI_THEME_TOKEN,
        themeId: previewTheme.id,
      });
      console.error(error);
    }
  }

  logStep("Update preview theme");
  let cliOutput = "";
  await exec.exec(
    `shopify theme push`,
    [
      "--stable",
      `--nodelete`,
      `--json`,
      `--theme=${previewTheme.id}`,
      "--ignore=config/settings_data.json",
    ],
    {
      listeners: {
        stdout: (data) => {
          cliOutput += data.toString();
        },
      },
    }
  );
  const { theme } = JSON.parse(cliOutput) as Record<string, any>;
  logStep("Preview theme ready");
  console.log(theme);

  if (isStaging) {
    await exec.exec(`shopify theme rename`, [
      `--theme=${previewTheme.id}`,
      `--name=ALRUBAN/Preprod | ${new Intl.DateTimeFormat("en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date())}`,
    ]);
  }

  core.setOutput("preview_url", theme.preview_url.replace("https://", ""));

  logStep("Create github comment");
  await createGitHubComment(previewTheme.id);
}

// Execute

try {
  runAction();
} catch (error) {
  core.setFailed(error);
}
