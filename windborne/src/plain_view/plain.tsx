import React, { useEffect, useMemo, useState, useCallback } from "react";
import SelectionSidebar from "./selectionSidebar";
import StationDialog from "../utils/stationDialog";
import { getStationsOnce, type StationRecord } from "../utils/stationCache";
import MultiStationDialog from "../utils/MultiStationDialog";
import { useStationSearch } from "../utils/searchStation";

export type PlainProps = {
  stationUrl?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  makePointsUrl?: (id: string) => string;
};

export default function Plain({
  stationUrl = "https://sfc.windbornesystems.com/stations",
  title = "Windborne Project",
  className,
  style,
  makePointsUrl = (id) =>
    `https://sfc.windbornesystems.com/historical_weather?station=${id}`,
}: PlainProps) {
  // Searching States
  const [query, setQuery] = useState("");
  const { hits, loading } = useStationSearch(query);
  // const [stations, setStations] = useState<StationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // const [loading, setLoading] = useState<boolean>(true);

  // Viewing States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewId, setViewId] = useState<{ id: string, name: string } | null>(null);
  const [showMulti, setShowMulti] = useState(false);

  // useEffect(() => {
  //   let cancelled = false;
  //   // setLoading(true);
  //   setError(null);
  //   getStationsOnce(stationUrl, { ttlMs: 6 * 60 * 60 * 1000, useETag: true })
  //     .then((recs) => {
  //       if (!cancelled) setStations(recs);
  //     })
  //     .catch((e) => {
  //       if (!cancelled) setError(String(e));
  //     })
  //     .finally(() => {
  //       if (!cancelled) setLoading(false);
  //     });
  //   return () => {
  //     cancelled = true;
  //   };
  // }, [stationUrl]);

  // // Build a simple search index (id + name + timezone, lowercased)
  // const indexed = useMemo(() => {
  //   if (!stations) return [] as Array<{ rec: StationRecord; hay: string }>;
  //   return stations.map((rec) => ({
  //     rec,
  //     hay: [rec.station_id, rec.station_name, rec.timezone]
  //       .filter(Boolean)
  //       .map((s) => String(s).toLowerCase())
  //       .join(" \u2002 "), // thin spaces between fields
  //   }));
  // }, [stations]);

  // const results = useMemo(() => {
  //   const q = query.trim().toLowerCase();
  //   if (!q) return indexed;
  //   return indexed.filter(({ hay }) => hay.includes(q));
  // }, [indexed, query]);

  const selectedRecords = useMemo(
    () => (hits ?? []).filter((s) => selectedIds.includes(s.station_id)),
    [hits, selectedIds]
  );

  const addToSelection = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const removeFromSelection = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  return (
    <div style={{ background: "#0f0f12", minHeight: "100vh" }}>
      
      <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr"}}>
        {/* Title */}
        <header
            style={{
            display: "grid",
            placeItems: "center",
            padding: "18px 12px 8px",
            }}
        >
            <h1
            style={{
                margin: 0,
                color: "#e6e6e6",
                fontWeight: 700,
                letterSpacing: 0.5,
                fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
            }}
            >
            {title}
            </h1>
        </header>

        {/* Search bar */}
        <div
            style={{
            display: "flex",
            justifyContent: "center",
            padding: "6px 12px 14px",
            }}
        >
            <div style={{ width: "min(720px, 92vw)", position: "relative" }}>
            <input
                className="plain-input"
                type="search"
                placeholder="Search stations by ID, name, or timezone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search stations"
                style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #3a3a3f",
                background: "#1a1a1f",
                color: "#e8e8ea",
                outline: "none",
                boxShadow: "0 0 0 0 rgba(0,0,0,0)",
                }}
                onFocus={(e) =>
                (e.currentTarget.style.border = "1px solid #54545a")
                }
                onBlur={(e) => (e.currentTarget.style.border = "1px solid #3a3a3f")}
            />
            </div>
        </div>
        
        {/* Main Content */}
        <div
            className={className}
            style={{
            width: "100%",
            height: "100%",
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1fr 2fr 1fr",
            background: "#0f0f12",
            ...style,
            }}
        >
            {/* Left selection box */}
            <SelectionSidebar
            selected={selectedRecords}
            onRemove={removeFromSelection}
            onClear={clearSelection}
            onViewSelection={() => setShowMulti(true)}
            />


            {/* Results */}
            <main
            style={{
                // padding: "0 12px 16px",
                overflow: "auto",
                height: "100%",
                display: "flex",
                justifyContent: "center",
            }}
            >
            <div style={{ width: "min(800px, 80vw)" }}>
                {loading && (
                <div style={{ color: "#bbb", padding: "16px" }}>
                    Loading stations…
                </div>
                )}
                {error && (
                <div style={{ color: "#ff9b9b", padding: "16px" }}>
                    Failed to load: {error}
                </div>
                )}
                {!loading && !error && (
                <>
                    {/* <div style={{ color: "#9aa", padding: "8px 4px" }}>
                    {results.length} result{results.length !== 1 ? "s" : ""}{" "}
                    {query ? `for “${query}”` : ""}
                    </div> */}
                    <div style={{ display: "grid", gap: 8, maxHeight: '80vh' }}>
                    {results.map(({ rec }) => {
                        const added = selectedIds.includes(rec.station_id);
                        return (
                        <article
                            key={rec.station_id}
                            style={{
                            border: "1px solid #2b2b2f",
                            background: "#141418",
                            borderRadius: 10,
                            padding: "12px 14px",
                            color: "#ddd",
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            gap: 8,
                            }}
                        >
                            <div>
                            <div style={{ fontWeight: 600 }}>
                                {rec.station_id}
                                {rec.station_name ? ` — ${rec.station_name}` : ""}
                            </div>
                            <div
                                style={{
                                fontSize: 12,
                                color: "#a9abb3",
                                marginTop: 4,
                                }}
                            >
                                {rec.timezone ?? "—"}
                                {rec.station_network
                                ? ` • ${rec.station_network}`
                                : ""}
                                {Number.isFinite(rec.elevation as any)
                                ? ` • ${rec.elevation} m`
                                : ""}
                            </div>
                            </div>

                            <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => setViewId({id: rec.station_id, name: rec.station_name ?? ""})}
                                style={{
                                background: "#2c62ff",
                                color: "#fff",
                                border: "none",
                                padding: "8px 12px",
                                borderRadius: 8,
                                cursor: "pointer",
                                }}
                            >
                                View
                            </button>
                            <button
                                onClick={() => addToSelection(rec.station_id)}
                                disabled={added}
                                title={
                                added
                                    ? "Already in selection"
                                    : "Add"
                                }
                                style={{
                                background: added ? "#26304a" : "transparent",
                                color: added ? "#9fb2ff" : "#c9ced8",
                                border: "1px solid #2a2d36",
                                padding: "8px 12px",
                                borderRadius: 8,
                                cursor: added ? "default" : "pointer",
                                }}
                            >
                                {added ? "Added" : "Add"}
                            </button>
                            </div>
                        </article>
                        );
                    })}
                    </div>
                </>
                )}
            </div>
            </main>
        </div>
      </div>
      {/* Single-station dialog (reuses the globe’s modal) */}
      {viewId && (
        <StationDialog
          stationId={viewId.id}
          stationName={viewId.name}
          makeUrl={makePointsUrl}
          onClose={() => setViewId(null)}
        />
      )}

      {/* Multi-station dialog */}
      {showMulti && selectedIds.length > 0 && (
        <MultiStationDialog
          stationIds={selectedIds}
          onClose={() => setShowMulti(false)}
        />
      )}

      <style>{`.plain-input::placeholder { color: #8a8a90; }`}</style>
    </div>
  );
}
