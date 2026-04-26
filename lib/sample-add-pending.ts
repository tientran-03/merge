
export function isSampleAddPendingApproval(status: string | undefined | null): boolean {
  const s = (status ?? "").toLowerCase().trim();
  return s === "initation" || s === "initiation" || s === "forward_analysis";
}
