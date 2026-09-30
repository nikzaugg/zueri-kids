export type Issue = { file: string; path: string; message: string };

// ["offers", 0, "schedule"] -> "offers[0].schedule"
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === "number") return `${acc}[${seg}]`;
    return acc ? `${acc}.${String(seg)}` : String(seg);
  }, "");
}

export function formatIssue(issue: Issue): string {
  return issue.path ? `${issue.file}: ${issue.path}: ${issue.message}` : `${issue.file}: ${issue.message}`;
}
