import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const SITE = "https://ancientmysteriesrediscovered.com/";
const HOST = "ancientmysteriesrediscovered.com";
const KEY_FILE = "indexnow.txt";
const KEY_LOCATION = `${SITE}${KEY_FILE}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

function readLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function runGit(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function changedFilesFromGitHubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return [];

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const before = event.before;
  const after = event.after || "HEAD";

  if (!before || /^0+$/.test(before)) {
    return runGit(["diff", "--name-only", `${after}^`, after]).split(/\r?\n/).filter(Boolean);
  }

  return runGit(["diff", "--name-only", before, after]).split(/\r?\n/).filter(Boolean);
}

function urlFromDirectory(directory) {
  if (!directory || directory === ".") return SITE;
  const normalized = directory.replaceAll("\\", "/").replace(/\/+$/, "");
  return `${SITE}${normalized}/`;
}

function fileToUrls(file) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.startsWith(".github/") || normalized.startsWith("scripts/")) return [];
  if (normalized === KEY_FILE || normalized === "indexnow-urls.txt" || normalized === "README.md") return [];
  if (normalized === "index.html") return [SITE];

  if (normalized.endsWith("/index.html")) {
    return [urlFromDirectory(path.posix.dirname(normalized))];
  }

  const directory = path.posix.dirname(normalized);
  if (directory && directory !== "." && existsSync(path.join(directory, "index.html"))) {
    return [urlFromDirectory(directory)];
  }

  return [];
}

function productionUrlOnly(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === HOST && parsed.href.startsWith(SITE);
  } catch {
    return false;
  }
}

const key = readFileSync(KEY_FILE, "utf8").trim();
if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  throw new Error(`Invalid IndexNow key in ${KEY_FILE}`);
}

const changedFiles = changedFilesFromGitHubEvent();
const manualFileUrls = changedFiles.includes("indexnow-urls.txt") ? readLines("indexnow-urls.txt") : [];
const manualInputUrls = (process.env.INDEXNOW_URLS || "").split(/\s+/).map((url) => url.trim()).filter(Boolean);
const manualUrls = [...manualFileUrls, ...manualInputUrls];
const changedUrls = changedFiles.flatMap(fileToUrls);
const urlList = [...new Set([...manualUrls, ...changedUrls])].filter(productionUrlOnly);

if (urlList.length === 0) {
  console.log("No production URLs detected for IndexNow submission.");
  process.exit(0);
}

const payload = { host: HOST, key, keyLocation: KEY_LOCATION, urlList };
console.log(`Submitting ${urlList.length} URL(s) to IndexNow:`);
for (const url of urlList) console.log(`- ${url}`);

if (process.argv.includes("--dry-run")) {
  console.log("Dry run complete. No IndexNow request sent.");
  process.exit(0);
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

const responseText = await response.text();
console.log(`IndexNow response: ${response.status} ${response.statusText}`);
if (responseText) console.log(responseText);

if (!response.ok && response.status !== 202) {
  process.exitCode = 1;
}
