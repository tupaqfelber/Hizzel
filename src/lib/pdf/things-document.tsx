import path from "node:path";
import { Document, Page, View, Text, Image, Svg, Path, Font, StyleSheet } from "@react-pdf/renderer";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { CATEGORY_ICON_PATHS } from "@/lib/pdf/category-icon-paths";
import { formatDate } from "@/lib/format-date";
import type { ThingCategory } from "@/lib/supabase/types";

// Real local files, not a CSS @import — react-pdf needs actual font data
// via Font.register(), and this way generation has no network dependency
// at all. Registered once per process (Next.js reuses warm serverless
// instances, so this module only actually runs on cold start).
Font.register({
  family: "DM Sans",
  fonts: [
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/DMSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/DMSans-Medium.ttf"), fontWeight: 500 },
  ],
});
Font.register({
  family: "DM Serif Display",
  fonts: [{ src: path.join(process.cwd(), "src/lib/pdf/fonts/DMSerifDisplay-Regular.ttf") }],
});

// A4 at 72pt/inch: 595.28 x 841.89pt.
const PAGE_PADDING = 36;
const GRID_GAP = 8;
const COLUMNS = 5;
const CONTENT_WIDTH = 595.28 - PAGE_PADDING * 2;
const CARD_WIDTH = (CONTENT_WIDTH - GRID_GAP * (COLUMNS - 1)) / COLUMNS;
// A room's header+grid is kept on one page (`wrap={false}`) only up to
// this many items — verified empirically (a 55-item test room actually
// LOST content past ~25 items: wrap={false} on a block taller than one
// full page doesn't paginate it, it force-renders past the page edge and
// whatever falls beyond that boundary is gone from the output, not just
// visually clipped). ~20 items (4 rows) comfortably fits even starting
// completely fresh at the top of a page, so it's never at risk of that —
// past this threshold, real pagination (the default `wrap`) takes over,
// which can split the room's grid across a page break but, critically,
// never drops an item. Never losing a user's own inventory beats a
// slightly-awkward mid-room page break.
const MAX_ITEMS_TO_KEEP_TOGETHER = 20;

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#F5F2EC",
    padding: PAGE_PADDING,
    paddingBottom: PAGE_PADDING + 14, // room for the fixed page-number footer
    fontFamily: "DM Sans",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 10,
    paddingBottom: 14,
    borderBottomWidth: 1.2,
    borderBottomColor: "#DED8CA",
  },
  logo: { width: 42, height: 42 },
  headerText: { flex: 1 },
  wordmark: { fontSize: 8, color: "#A09890", marginBottom: 4, letterSpacing: 0.4 },
  moveTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  moveTitle: { fontFamily: "DM Serif Display", fontSize: 19, color: "#2C2A25" },
  moveTitleArrow: { width: 15, height: 15, marginTop: 2 },
  moveMeta: { fontSize: 8.5, color: "#8A8378", marginTop: 7, lineHeight: 1.5 },
  metaBold: { color: "#5C574F", fontWeight: 500 },
  roomHeader: {
    fontSize: 8,
    fontWeight: 500,
    color: "#A09890",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, marginBottom: 4 },
  card: { width: CARD_WIDTH, borderRadius: 6, backgroundColor: "#EDEAE2", overflow: "hidden" },
  // An explicit height (not aspectRatio) — cheap insurance against Yoga
  // mis-measuring a grid item's height before the container's own total
  // height is known, which would misposition whatever renders after it.
  cardImg: { width: CARD_WIDTH, height: CARD_WIDTH, alignItems: "center", justifyContent: "center" },
  cardInfo: {
    padding: 5,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(44,42,37,0.06)",
  },
  cardName: { fontSize: 7.5, fontWeight: 500, color: "#2C2A25" },
  cardDim: { fontSize: 6.5, color: "#A09890", marginTop: 1 },
  pageNumber: {
    position: "absolute",
    bottom: 16,
    right: PAGE_PADDING,
    fontSize: 8,
    color: "#A09890",
  },
});

export interface PdfThingItem {
  id: string;
  name: string;
  category: ThingCategory;
  width_cm: number;
  depth_cm: number;
  photo_url: string | null;
}

export interface PdfThingGroup {
  key: string;
  roomName: string;
  areaName: string | null;
  items: PdfThingItem[];
}

export interface ThingsDocumentProps {
  userEmail: string;
  currentPropertyName: string;
  newPropertyName: string;
  moveDate: string | null;
  totalCount: number;
  moverName: string | null;
  moverPhone: string | null;
  notes: string | null;
  groups: PdfThingGroup[];
}

function ItemCardPdf({ item }: { item: PdfThingItem }) {
  const color = CATEGORY_COLORS[item.category];
  const paths = CATEGORY_ICON_PATHS[item.category];

  return (
    // wrap={false} here specifically — a single card is tiny (always
    // fits, even forced onto a fresh page), so this carries none of the
    // "oversized block" risk a whole room's wrap={false} had. Without it,
    // a large room's grid (left to paginate freely past
    // MAX_ITEMS_TO_KEEP_TOGETHER) could split an individual card's image
    // and its name/dimensions across the page break — no data lost, just
    // visually broken for whichever cards land on that boundary.
    <View style={styles.card} wrap={false}>
      <View style={[styles.cardImg, { backgroundColor: item.photo_url ? undefined : color.pastel }]}>
        {item.photo_url ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={item.photo_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
            {paths.map((d, i) => (
              // stroke as a plain hex + a separate strokeOpacity, not a
              // manually-built rgba(...) string — react-pdf's underlying
              // color parser didn't handle that reliably (icons rendered
              // in the wrong, seemingly-random colors when tested).
              <Path
                key={i}
                d={d}
                stroke={color.bold}
                strokeOpacity={0.4}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardDim}>
          {item.width_cm}×{item.depth_cm}
        </Text>
      </View>
    </View>
  );
}

export function ThingsDocument({
  userEmail,
  currentPropertyName,
  newPropertyName,
  moveDate,
  totalCount,
  moverName,
  moverPhone,
  notes,
  groups,
}: ThingsDocumentProps) {
  return (
    <Document title="My Things">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is a PDF-rendering primitive, not an HTML <img>; it has no alt prop */}
          <Image src={path.join(process.cwd(), "public/logo.png")} style={styles.logo} />
          <View style={styles.headerText}>
            <Text style={styles.wordmark}>www.hizzel.app · {userEmail}</Text>
            {/* The arrow is drawn as an SVG, not a "→" character — DM
                Serif Display's embedded font file doesn't include that
                glyph, and unlike a browser, react-pdf doesn't silently
                substitute a fallback font for a missing character (it
                rendered as a stray quote mark instead when tested). */}
            <View style={styles.moveTitleRow}>
              <Text style={styles.moveTitle}>{currentPropertyName}</Text>
              <Svg viewBox="0 0 24 24" style={styles.moveTitleArrow}>
                <Path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="#2C2A25"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
              <Text style={styles.moveTitle}>{newPropertyName}</Text>
            </View>
            <Text style={styles.moveMeta}>
              Move date: <Text style={styles.metaBold}>{moveDate ? formatDate(moveDate) : ""}</Text>
              {"  ·  "}
              {totalCount} things
              {"  ·  "}
              Mover: <Text style={styles.metaBold}>{moverName ?? ""}</Text>
              {"  ·  "}
              Mover phone: <Text style={styles.metaBold}>{moverPhone ?? ""}</Text>
            </Text>
            <Text style={[styles.moveMeta, { marginTop: 2 }]}>
              Notes: <Text style={styles.metaBold}>{notes ?? ""}</Text>
            </Text>
          </View>
        </View>

        {groups.map((group) => (
          <View key={group.key} wrap={group.items.length > MAX_ITEMS_TO_KEEP_TOGETHER}>
            <Text style={styles.roomHeader}>
              {group.areaName ? `${group.areaName} · ${group.roomName}` : group.roomName}
            </Text>
            <View style={styles.grid}>
              {group.items.map((item) => (
                <ItemCardPdf key={item.id} item={item} />
              ))}
            </View>
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
