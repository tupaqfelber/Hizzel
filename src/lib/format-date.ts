// Shared by the My Hizzel overlay (client) and the Things PDF export
// (server) — same "14 March 2027" style everywhere a move date is shown,
// rather than two copies of the same formatting drifting apart.
export function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
