import { spawnSync } from "child_process";

function runCmd(cmd: string, args: string[], options = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

function getBranches() {
  const res = spawnSync("git", ["branch"], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error("Failed to list branches");
  return res.stdout
    .split("\n")
    .map((b) => b.trim().replace(/^\*\s*/, ""))
    .filter(Boolean);
}

function getRemoteBranches() {
  const res = spawnSync("git", ["branch", "-r"], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error("Failed to list remote branches");
  return res.stdout
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => b.replace("origin/", ""));
}

function getLocalTags() {
  const res = spawnSync("git", ["tag"], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error("Failed to list local tags");
  return res.stdout
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

function getRemoteTags() {
  const res = spawnSync("git", ["ls-remote", "--tags", "origin"], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error("Failed to list remote tags");
  // output like: <hash> refs/tags/<tagname>
  return res.stdout
    .split("\n")
    .map((line) => {
      const m = line.match(/refs\/tags\/(.+)$/);
      return m ? m[1] : null;
    })
    .filter(Boolean) as string[];
}

function deleteRemoteTag(tag: string) {
  runCmd("git", ["push", "origin", "--delete", tag]);
}

function pushAllTags() {
  runCmd("git", ["push", "--tags"]);
}

function main() {
  const branch = process.argv[2];
  if (!branch) {
    console.error("Usage: tsx reset.ts <branch>");
    process.exit(1);
  }

  console.log(`⚙️  Resetting repository with new root branch: ${branch}`);

  // 1) Create orphan branch new-root-branch
  runCmd("git", ["checkout", "--orphan", "new-root-branch"]);

  // 2) Add all files
  runCmd("git", ["add", "-A"]);

  // 3) Commit with message
  runCmd("git", ["commit", "-m", "first commit"]);

  // 4) Rename new-root-branch to <branch>
  runCmd("git", ["branch", "-M", branch]);

  // 5) Force push branch to origin
  runCmd("git", ["push", "--force", "origin", branch]);

  // 6) Delete all other local branches
  const localBranches = getBranches().filter((b) => b !== branch);
  if (localBranches.length) {
    console.log(`🧹 Deleting local branches: ${localBranches.join(", ")}`);
    for (const b of localBranches) {
      runCmd("git", ["branch", "-D", b]);
    }
  }

  // 7) Delete all other remote branches
  const remoteBranches = getRemoteBranches().filter((b) => b !== branch);
  if (remoteBranches.length) {
    console.log(`🧹 Deleting remote branches: ${remoteBranches.join(", ")}`);
    for (const b of remoteBranches) {
      runCmd("git", ["push", "origin", "--delete", b]);
    }
  }

  // 8) Delete all remote tags
  const remoteTags = getRemoteTags();
  if (remoteTags.length) {
    console.log(`🧹 Deleting remote tags: ${remoteTags.join(", ")}`);
    for (const tag of remoteTags) {
      deleteRemoteTag(tag);
    }
  }

  // 9) Push all local tags to remote
  console.log("🚀 Pushing all local tags to origin");
  pushAllTags();

  console.log("✅ Reset complete.");
}

main();
