export function hasReconciliationData(pumpCount: number, transactionCount: number) {
  return pumpCount > 0 && transactionCount > 0;
}