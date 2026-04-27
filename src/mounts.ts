import * as fs from "fs";
import * as os from "os";
import { MOUNTS_PATH, ensureAppdataDir } from "./config";
import { getMounts as getMountsFromConfig } from "./config-loader";
import { printInfo, promptYesNo } from "./utils";

export async function ensureMountsFile(): Promise<void> {
  if (fs.existsSync(MOUNTS_PATH)) {
    return;
  }

  ensureAppdataDir();
  const home = os.homedir();
  const mounts: string[] = [];

  printInfo("");
  printInfo("MOUNTS.txt not found. Creating....");
  printInfo("");
  printInfo("Would you like to mount ~/.ssh (read-only)?");
  printInfo(
    "  Pros: Enables SSH-based git operations and remote server access inside the container. (E.g.: git push, git pull)"
  );
  printInfo(
    "  Risks: Exposes your SSH private keys. Only enable if you trust the code running in your containers."
  );
  printInfo(
    "  Note: This configuration is global. You may modify your mounts at any time by editing ~/.code-container/MOUNTS.txt."
  );

  const mountSsh = await promptYesNo("Mount ~/.ssh?");
  if (mountSsh) {
    mounts.push(`${home}/.ssh:/root/.ssh:ro`);
  }

  fs.writeFileSync(MOUNTS_PATH, mounts.join("\n") + "\n", { mode: 0o600 });
  printInfo("");
  printInfo(`Created ${MOUNTS_PATH}`);
  printInfo("Add extra mount points to this file (for backwards compatibility).");
  printInfo("Primary configuration is now in config.yaml");
}

export function loadMounts(): string[] {
  const configMounts = getMountsFromConfig();
  const mountSet = new Set(configMounts);

  // Support legacy MOUNTS.txt for backwards compatibility
  if (fs.existsSync(MOUNTS_PATH)) {
    const content = fs.readFileSync(MOUNTS_PATH, "utf-8");
    const extraMounts = content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"));
    for (const mount of extraMounts) {
      mountSet.add(mount);
    }
  }

  return Array.from(mountSet);
}

