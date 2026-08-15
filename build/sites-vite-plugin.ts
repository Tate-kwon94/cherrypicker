import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * Wrangler records the config file it read using an absolute path, which puts
 * the build machine's home directory into the deploy artifact. Rewrite those
 * to repo-relative so the output is reproducible across machines and does not
 * disclose local paths. The fields stay present, only the value changes.
 */
async function relativizeConfigPaths(root: string, outputFile: string) {
  if (!(await exists(outputFile))) return;

  const config = JSON.parse(await readFile(outputFile, "utf8")) as Record<
    string,
    unknown
  >;
  let changed = false;

  for (const field of ["configPath", "userConfigPath"]) {
    const value = config[field];
    if (typeof value === "string" && value.startsWith("/")) {
      config[field] = relative(root, value);
      changed = true;
    }
  }

  if (changed) await writeFile(outputFile, JSON.stringify(config));
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }

      await relativizeConfigPaths(
        root,
        resolve(root, "dist", "server", "wrangler.json"),
      );
    },
  };
}
