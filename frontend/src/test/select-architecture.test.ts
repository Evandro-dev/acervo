import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const sourceDirectory = resolve("src");

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function normalizePath(path: string) {
  return relative(sourceDirectory, path).split(sep).join("/");
}

const applicationFiles = listSourceFiles(sourceDirectory).filter(
  (path) => !normalizePath(path).startsWith("test/"),
);

describe("select architecture", () => {
  it("keeps simple dropdown primitives centralized and removes native selects", () => {
    const nativeDropdownFiles = applicationFiles
      .filter((path) => /<select\b|<datalist\b/.test(readFileSync(path, "utf8")))
      .map(normalizePath);
    const directRadixImports = applicationFiles
      .filter((path) => readFileSync(path, "utf8").includes('from "@radix-ui/react-select"'))
      .map(normalizePath)
      .filter((path) => path !== "components/ui/select.tsx");

    expect(nativeDropdownFiles).toEqual([]);
    expect(directRadixImports).toEqual([]);
  });

  it("uses the shared scrollbar style in every dropdown family", () => {
    const simpleSelect = readFileSync(resolve("src/components/ui/select.tsx"), "utf8");
    const commandList = readFileSync(resolve("src/components/ui/command.tsx"), "utf8");
    const courseMultiCombobox = readFileSync(resolve("src/components/ui/course-multi-combobox.tsx"), "utf8");

    expect(simpleSelect).toContain("acervo-dropdown-scrollbar");
    expect(commandList).toContain("acervo-dropdown-scrollbar");
    expect(courseMultiCombobox).toContain("acervo-dropdown-scrollbar");
    expect(simpleSelect).not.toMatch(/ScrollUpButton|ScrollDownButton/);
  });
});
