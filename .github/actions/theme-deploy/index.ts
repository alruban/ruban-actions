import * as exec from "@actions/exec";
import * as core from "@actions/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import diff from "microdiff";
import { getManifestAsset, logStep, removeAssets } from "../../../lib/utils";

async function runAction() {
  if (!process.env.BUILD_MANIFEST)
    throw new Error("Missing [BUILD_MANIFEST] environment variable");
  if (!process.env.SHOPIFY_FLAG_THEME_ID)
    throw new Error("Missing [SHOPIFY_FLAG_THEME_ID] environment variable");
  if (!process.env.SHOPIFY_FLAG_STORE)
    throw new Error("Missing [SHOPIFY_FLAG_STORE] environment variable");
  if (!process.env.SHOPIFY_CLI_THEME_TOKEN)
    throw new Error("Missing [SHOPIFY_CLI_THEME_TOKEN] environment variable");

  const manifestFile = process.env.BUILD_MANIFEST;
  const themeRoot = process.env.SHOPIFY_FLAG_PATH ?? "./";

  logStep("Download previous build manifest file");
  const previousBuildManifest = await getManifestAsset({
    asset: manifestFile,
    password: process.env.SHOPIFY_CLI_THEME_TOKEN,
    shop: process.env.SHOPIFY_FLAG_STORE,
    themeId: process.env.SHOPIFY_FLAG_THEME_ID,
  });

  logStep("Calculate diff");
  const currentBuildManifest = JSON.parse(
    fs.readFileSync(path.join(themeRoot, manifestFile), "utf-8")
  );

  const changedDiff = diff(previousBuildManifest, currentBuildManifest);

  if (changedDiff.length === 0) {
    core.notice(`No file changes detected for this store`);
    return;
  }

  const tReg = /templates.+\.json/;
  const filesToUpload = changedDiff
    .filter(({ type, path }) => {
      if (type === "CHANGE" && tReg.test(path.join(""))) return false;
      return ["CHANGE", "CREATE"].includes(type);
    })
    .map(({ path }) => path.join(""))
    .concat([manifestFile]);

  if (filesToUpload.length) {
    logStep("Uploading files");
    console.log({ filesToUpload });
    await exec.exec(`pnpm shopify theme push`, [
      "--allow-live",
      "--nodelete",
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
}

// Execute

try {
  runAction();
} catch (error) {
  core.setFailed(error);
}
