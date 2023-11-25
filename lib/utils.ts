import * as github from "@actions/github";
import * as core from "@actions/core";
import PQueue from "p-queue";
import { Client, request } from "undici";

type Theme = {
  created_at: string;
  id: number;
  name: string;
  previewable: boolean;
  processing: boolean;
  role: "main" | "unpublished" | "demo" | "development";
  theme_store_id: number | null;
  updated_at: string;
};

const BASE_URL = "https://theme-kit-access.shopifyapps.com";
const API_VERSION = "2023-01";

export async function getStoreThemes(props: {
  shop: string;
  password: string;
}) {
  const { body } = await request(
    `${BASE_URL}/cli/admin/api/${API_VERSION}/themes.json`,
    {
      headers: {
        "X-Shopify-Access-Token": props.password,
        "X-Shopify-Shop": props.shop,
      },
    }
  );

  const { themes } = (await body.json()) as { themes: Theme[] };

  return themes;
}

export async function createTheme(props: {
  shop: string;
  password: string;
  themeName: string;
  role?: "unpublished" | "development";
}) {
  const { body } = await request(
    `${BASE_URL}/cli/admin/api/${API_VERSION}/themes.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": props.password,
        "X-Shopify-Shop": props.shop,
      },
      body: JSON.stringify({
        theme: {
          name: props.themeName,
          role: props.role ?? "unpublished",
        },
      }),
    }
  );

  const { theme } = (await body.json()) as { theme: Theme };

  return theme;
}

export async function deleteTheme(props: {
  shop: string;
  password: string;
  themeId: number;
}) {
  const { body } = await request(
    `${BASE_URL}/cli/admin/api/${API_VERSION}/themes/${props.themeId}.json`,
    {
      method: "DELETE",
      headers: {
        "X-Shopify-Access-Token": props.password,
        "X-Shopify-Shop": props.shop,
      },
    }
  );

  const theme = (await body.json()) as Theme;

  return theme;
}

export async function getManifestAsset(props: {
  asset: string;
  password: string;
  shop: string;
  themeId: number | string;
}) {
  const { body } = await request(
    `${BASE_URL}/cli/admin/api/${API_VERSION}/themes/${props.themeId}/assets.json?asset[key]=${props.asset}`,
    {
      headers: {
        "X-Shopify-Access-Token": props.password,
        "X-Shopify-Shop": props.shop,
      },
    }
  );

  const { asset } = ((await body.json()) ?? {}) as {
    asset?: { attachment: string };
  };

  if (!asset) return {};
  return JSON.parse(Buffer.from(asset.attachment, "base64").toString("utf8"));
}

export async function removeAssets(props: {
  shop: string;
  password: string;
  themeId: number | string;
  files: string[];
}) {
  const queue = new PQueue({ concurrency: 2 });
  const client = new Client(BASE_URL, {
    pipelining: 2,
  });

  logQueueProgress: {
    let count = 0;
    queue.on("next", () => {
      console.log(
        `${count + 1}/${props.files.length} | Deleting [${props.files[count]}]`
      );
      count++;
    });
  }

  for (const file of props.files) {
    queue.add(() =>
      client.request({
        path: `/cli/admin/api/${API_VERSION}/themes/${props.themeId}/assets.json?asset[key]=${file}`,
        method: "DELETE",
        headers: {
          "X-Shopify-Access-Token": props.password,
          "X-Shopify-Shop": props.shop,
        },
      })
    );
  }

  await queue.onIdle();
  await client.close();
}

export function logStep(name: string) {
  core.info(
    `\n==============================\n${name}\n==============================\n`
  );
}

export async function createGitHubComment(themeId: number) {
  const prID = github.context.payload.pull_request?.number;
  if (!prID) {
    throw new Error("Unable to find PR");
  }

  if (!process.env.GITHUB_TOKEN) {
    throw new Error("Missing {GITHUB_TOKEN} environment variable");
  }

  // TODO: Preview specific for current store?

  const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
  const commentIdentifier =
    "<!-- Comment by Shopify Theme Deploy Previews Action -->";
  let commentID;

  findCommentId: {
    core.debug(`[DEBUG] - Searching for comment`);
    const { data: listOfComments } = await octokit.rest.issues.listComments({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: prID,
    });
    commentID = listOfComments.find((comment) =>
      comment.body?.includes(commentIdentifier)
    )?.id;
    if (commentID) core.debug(`[DEBUG] - Found comment with ID: ${commentID}`);
    else core.debug(`[DEBUG] - Comment not found`);
  }

  const commentBody = `${commentIdentifier}\n🚀 Preview created successfully!\nPlease add the below urls to Jira ticket (if applicable) for the PM/QA to review.\n

  ${"```"}
  Share this theme preview:
  https://${process.env.SHOPIFY_FLAG_STORE}/?preview_theme_id=${themeId}

  Customize this theme in the Theme Editor
  https://${process.env.SHOPIFY_FLAG_STORE}/admin/themes/${themeId}/editor`;

  try {
    if (commentID) {
      core.debug(`[DEBUG] - Updating comment for ID={${commentID}}`);
      await octokit.rest.issues.updateComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        comment_id: commentID,
        body: commentBody,
      });
      core.debug(`[DEBUG] - Comment updated successfully`);
    } else {
      core.debug(`[DEBUG] - Creating comment`);
      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: prID,
        body: commentBody,
      });
      core.debug(`[DEBUG] - Comment added successfully`);
    }
  } catch (error) {
    core.debug(`[DEBUG] - Error while adding/updating comment`);
    core.setFailed(error.message);
  }
}
