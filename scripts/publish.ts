import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const PACKAGE_JSON_PATH = resolve(process.cwd(), "package.json");

function loadLocalToVersion(): Record<string, string> {
  const resolvePath = resolve(__dirname, "../resolve.json");
  if (!existsSync(resolvePath)) {
    console.warn("⚠️  resolve.json not found, using empty dependency override");
    return {};
  }

  try {
    const content = readFileSync(resolvePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ Failed to read or parse resolve.json");
    throw err;
  }
}

const LOCAL_TO_VERSION = loadLocalToVersion();

function readPackageJson(): any {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
}

function writePackageJson(pkg: any) {
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + "\n");
}

function getLocalDepsSnapshot(pkg: any) {
  const snapshot: Record<string, string> = {};
  for (const dep of Object.keys(LOCAL_TO_VERSION)) {
    if (pkg.dependencies?.[dep]) {
      snapshot[dep] = pkg.dependencies[dep];
    }
  }
  return snapshot;
}

function restoreLocalDeps(pkg: any, snapshot: Record<string, string>) {
  pkg.dependencies = pkg.dependencies || {};
  for (const [dep, version] of Object.entries(snapshot)) {
    pkg.dependencies[dep] = version;
  }
}

function patchDependencies(pkg: any): boolean {
  let changed = false;
  for (const [dep, version] of Object.entries(LOCAL_TO_VERSION)) {
    if (pkg.dependencies?.[dep]?.startsWith("file:")) {
      pkg.dependencies[dep] = version;
      changed = true;
      console.log(`🔁 Patched '${dep}' to '${version}'`);
    }
  }
  return changed;
}

function runNpmVersion(
  bump: "patch" | "minor" | "major" | "prerelease" | "prepatch" | "preminor" | "premajor",
  preid?: string
) {
  const args = ["version", bump, "--no-git-tag-version"];
  if (preid) {
    args.push(`--preid=${preid}`);
  }
  console.log(`🚀 Running: npm ${args.join(" ")}`);
  const result = spawnSync("npm", args, { stdio: "inherit" });

  if (result.status !== 0) {
    throw new Error(`❌ npm version failed with exit code ${result.status}`);
  }
}

function publish() {
  console.log("🚀 Publishing to npm...");
  const result = spawnSync("npm", ["publish", "--access", "public"], { stdio: "inherit" });

  if (result.status !== 0) {
    throw new Error(`❌ npm publish failed with exit code ${result.status}`);
  }

  console.log("✅ Published successfully.");
}

function commitVersion(version: string) {
  spawnSync("git", ["add", "package.json", "package-lock.json"], { stdio: "inherit" });
  spawnSync("git", ["commit", "-m", `chore: bump version to ${version}`], { stdio: "inherit" });
  spawnSync("git", ["tag", `v${version}`], { stdio: "inherit" });
  spawnSync("git", ["push"], { stdio: "inherit" });
  spawnSync("git", ["push", "origin", `v${version}`], { stdio: "inherit" });
}

function getCurrentBranch(): string {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error("❌ Unable to determine current git branch");
  }
  return result.stdout.trim();
}

function main() {
  const currentBranch = getCurrentBranch();

  if (currentBranch !== "main") {
    console.error(`❌ Publish allowed only from 'main' branch. You are on '${currentBranch}'.`);
    process.exit(1);
  }

  let published = false;

  const bumpType = process.argv[2] as
    | "patch"
    | "minor"
    | "major"
    | "prerelease"
    | "prepatch"
    | "preminor"
    | "premajor"
    | undefined;
  const preid = process.argv[3]; // es: "alpha" o "beta"

  if (!bumpType) {
    console.error(
      "Usage: ts-node publish.ts <bumpType> [preid]\n" +
        "bumpType: patch, minor, major, prerelease, prepatch, preminor, premajor\n" +
        "preid: alpha, beta, ..."
    );
    process.exit(1);
  }

  const original = readPackageJson();
  const localDepsSnapshot = getLocalDepsSnapshot(original);

  const patched = JSON.parse(JSON.stringify(original));
  const didPatch = patchDependencies(patched);

  try {
    if (didPatch) {
      writePackageJson(patched);
    }

    runNpmVersion(bumpType, preid);
    publish();
    published = true;
  } catch (err) {
    console.error(err);
    writePackageJson(original);
    console.log("🔄 Ripristinato package.json originale (versione inclusa) dopo errore");
    process.exit(1);
  } finally {
    if (didPatch) {
      const currentPkg = readPackageJson(); // leggi file aggiornato da npm version
      restoreLocalDeps(currentPkg, localDepsSnapshot);
      writePackageJson(currentPkg);
      console.log("🔄 Restored local dependencies in package.json");
    }

    if (published) {
      const updatedPkg = readPackageJson();
      commitVersion(updatedPkg.version);
    }
  }
}

main();
