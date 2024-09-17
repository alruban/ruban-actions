import * as exec from "@actions/exec";
import * as core from "@actions/core";
import fs from "node:fs";
import path, { resolve } from "node:path";
import diff from "microdiff";
import {
  createTheme,
  getManifestAsset,
  getStoreThemes,
  logStep,
  removeAssets,
  toCapitalize,
} from "../../../lib/utils";

async function runAction() {
  if (!process.env.BUILD_MANIFEST)
    throw new Error("Missing [BUILD_MANIFEST] environment variable");
  if (!process.env.SHOPIFY_FLAG_THEME_ID)
    throw new Error("Missing [SHOPIFY_FLAG_THEME_ID] environment variable");
  if (!process.env.SHOPIFY_FLAG_STORE)
    throw new Error("Missing [SHOPIFY_FLAG_STORE] environment variable");
  if (!process.env.SHOPIFY_CLI_THEME_TOKEN)
    throw new Error("Missing [SHOPIFY_CLI_THEME_TOKEN] environment variable");
  if (!isThemeAccessToken(process.env.SHOPIFY_CLI_THEME_TOKEN))
    throw new Error(
      "[SHOPIFY_CLI_THEME_TOKEN] Please generate new access token via `Theme Kit Access` app and update it in repository settings."
    );

  const manifestFile = process.env.BUILD_MANIFEST;
  const manifestFileFallback = process.env.BUILD_MANIFEST_OLD as string;
  const themeRoot = process.env.SHOPIFY_FLAG_PATH ?? "./";

  logStep("Download previous build manifest file");
  const previousBuildManifest = await getManifestAsset({
    asset: manifestFile,
    assetFallback: manifestFileFallback,
    password: process.env.SHOPIFY_CLI_THEME_TOKEN,
    shop: process.env.SHOPIFY_FLAG_STORE,
    themeId: process.env.SHOPIFY_FLAG_THEME_ID,
  });

  logStep("Calculate diff");
  const manifestFileToRead = fs.existsSync(path.join(themeRoot, manifestFile))
    ? manifestFile
    : manifestFileFallback;
  const currentBuildManifest = JSON.parse(
    fs.readFileSync(path.join(themeRoot, manifestFileToRead), "utf-8")
  );

  const changedDiff = diff(previousBuildManifest, currentBuildManifest);
  if (changedDiff.length === 0) {
    logStep("No file changes detected for this theme");
    return;
  }

  // Create theme backup if needed
  if ([true, 'true'].includes(process.env["INPUT_CREATE-BACKUP"])) {
    const themeName = "ALRUBAN/Backup | ";
    logStep("Check if backup theme exists");
    const allThemes = await getStoreThemes({
      shop: process.env.SHOPIFY_FLAG_STORE,
      password: process.env.SHOPIFY_CLI_THEME_TOKEN,
    });
    let backupTheme = allThemes.find((t) => t.name.startsWith(themeName));
    if (!backupTheme) {
      backupTheme = await createTheme({
        shop: process.env.SHOPIFY_FLAG_STORE,
        password: process.env.SHOPIFY_CLI_THEME_TOKEN,
        themeName,
      });
    }
    console.log(backupTheme);

    const tmpRoot = resolve(themeRoot, "../dist-live-theme");

    logStep("Backup sync: Pull");
    await exec.exec(`shopify theme pull`, [
      "--stable",
      "--live",
      `--path=${tmpRoot}`,
    ]);

    logStep("Backup sync: Push");
    await exec.exec(`shopify theme push`, [
      "--stable",
      `--path=${tmpRoot}`,
      `--theme=${backupTheme.id}`,
    ]);

    logStep("Backup sync: Rename");
    await exec.exec(`shopify theme rename`, [
      `--theme=${backupTheme.id}`,
      `--name=${themeName + process.env.GITHUB_SHA?.slice(0, 7)}`,
    ]);
  }

  const NOT_ALLOWED = /(?:locales|settings_data).*\.json/;
  const jsonRegex = /(?:templates|sections).+\.json/;
  const filesToUpload = changedDiff
    .map(({ type, path }) => {
      if (type === "REMOVE") return false;

      const fullPath = path.join("");
      if (NOT_ALLOWED.test(fullPath)) return false;
      if (type === "CHANGE" && jsonRegex.test(fullPath)) return false;
      return fullPath;
    })
    .filter(Boolean)
    .concat([manifestFile]);

  if (filesToUpload.length) {
    logStep("Uploading files");
    console.log({ filesToUpload });
    await exec.exec(`shopify theme push`, [
      "--allow-live",
      "--nodelete",
      "--stable",
      ...filesToUpload.map((f) => `--only=${f}`),
    ]);
  }

  const filesToRemove = changedDiff
    .filter(({ type }) => type === "REMOVE")
    .map(({ path }) => path.join(""));

  if (filesToRemove.length) {
    logStep("Removing files");
    console.log({ filesToRemove });
    await removeAssets({
      shop: process.env.SHOPIFY_FLAG_STORE,
      password: process.env.SHOPIFY_CLI_THEME_TOKEN,
      themeId: process.env.SHOPIFY_FLAG_THEME_ID,
      files: filesToRemove,
    });
  }

  const themeName = `ALRUBAN/${toCapitalize(
    process.env.ENVIRONMENT_NAME as string
  )} | ${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date())}`;

  await exec.exec(`shopify theme rename`, [
    `--theme=${process.env.SHOPIFY_FLAG_THEME_ID}`,
    `--name=${themeName}`,
  ]);

  logStep("Deployment finished");
}

// Execute

try {
  runAction();
} catch (error) {
  core.setFailed(error);
}

function isThemeAccessToken(token: string) {
  return token.startsWith("shptka_");
}
