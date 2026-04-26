
export function canAddSupplementSampleToOrder(orderStatus: string | undefined | null): boolean {
  const s = (orderStatus ?? "").toLowerCase().trim();
  return s !== "initiation" && s !== "forward_analysis";
}
