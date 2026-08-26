export type PreflightIssueIdentity = {
  id: string;
  category: string;
  relatedPaths: readonly string[];
};

export function preflightIssueFingerprint(issue: PreflightIssueIdentity): string {
  return JSON.stringify([issue.id, issue.category, [...issue.relatedPaths].sort()]);
}
