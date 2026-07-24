import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(location);
    }
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
      ? [location]
      : [];
  });
}

function findRepositoryRoot(): string {
  let candidate = resolve(process.cwd());
  while (!existsSync(join(candidate, "pnpm-workspace.yaml"))) {
    const parent = resolve(candidate, "..");
    if (parent === candidate) {
      throw new Error("Could not find the Models Roundtable repository root.");
    }
    candidate = parent;
  }
  return candidate;
}

describe("architecture dependency boundaries", () => {
  it("prevents core and web code from importing provider packages", () => {
    const repositoryRoot = findRepositoryRoot();
    const protectedDirectories = [
      join(repositoryRoot, "packages", "core", "src"),
      join(repositoryRoot, "apps", "web", "src"),
    ];
    const source = protectedDirectories
      .flatMap((directory) => sourceFiles(directory))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(source).not.toMatch(/@models-roundtable\/provider-/u);
  });
});
