export function parseAuctionResponse(input: string): "REMIND" | "IGNORE" | null {
  const value = input.trim().toUpperCase();
  if (value === "A") return "REMIND";
  if (value === "B") return "IGNORE";
  return null;
}
