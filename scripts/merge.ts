import { spawnSync } from "child_process";

function runGitCommand(args: string[], errorMessage: string): void {
  const result = spawnSync("git", args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`Errore: ${errorMessage}`);
    process.exit(result.status ?? 1);
  }
}

function branchExists(branch: string): boolean {
  // Controlla branch locale
  const localCheck = spawnSync("git", ["rev-parse", "--verify", branch], { stdio: "ignore" });
  if (localCheck.status === 0) return true;

  // Controlla branch remoto origin/branch
  const remoteCheck = spawnSync("git", ["ls-remote", "--heads", "origin", branch], {
    encoding: "utf-8",
  });
  return remoteCheck.stdout.trim().length > 0;
}

function main() {
  const branch = process.argv[2];

  if (!branch) {
    console.error("Errore: devi passare il nome del branch da mergiare e ricreare, es: internal");
    process.exit(1);
  }

  console.log(`Branch da mergiare e ricreare: ${branch}`);

  // Checkout su main
  console.log("1. Checkout main");
  runGitCommand(["checkout", "main"], "Impossibile fare checkout su main");

  if (branchExists(branch)) {
    console.log(`2. Branch ${branch} esiste, faccio squash merge`);
    runGitCommand(["merge", "--squash", branch], "Merge squash fallito");

    console.log("3. Commit unico");
    const commitResult = spawnSync("git", ["commit", "-m", `Squash merge ${branch} into main`], {
      stdio: "inherit",
    });
    if (commitResult.status !== 0) {
      console.log("Nessuna modifica da committare, probabilmente già unito o niente da fare.");
    }

    console.log("4. Push main");
    runGitCommand(["push", "origin", "main"], "Push su main fallito");

    console.log(`5. Elimina branch locale ${branch}`);
    runGitCommand(["branch", "-D", branch], `Impossibile eliminare branch locale ${branch}`);

    console.log(`6. Elimina branch remoto ${branch}`);
    runGitCommand(
      ["push", "origin", "--delete", branch],
      `Impossibile eliminare branch remoto ${branch}`
    );
  } else {
    console.log(`2. Branch ${branch} non esiste, salto merge e resetto creazione`);
  }

  // Ricrea il branch da main e pusha
  console.log(`7. Ricrea branch ${branch} da main`);
  runGitCommand(["checkout", "-b", branch, "main"], `Impossibile creare branch ${branch}`);

  console.log(`8. Push nuovo branch ${branch}`);
  runGitCommand(["push", "origin", branch], `Push nuovo branch ${branch} fallito`);

  console.log("Operazione completata con successo!");
}

main();
