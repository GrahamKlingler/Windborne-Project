import React from "react";
import type { StationRecord } from "../utils/stationCache";
import type { Station } from "../utils/api";

export type SelectionSidebarProps = {
  selected: Station[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onViewSelection: () => void;
  className?: string;
  style?: React.CSSProperties;
};

export default function SelectionSidebar({
  selected,
  onRemove,
  onClear,
  onViewSelection,
  className,
  style,
}: SelectionSidebarProps) {
  const hasAny = selected.length > 0;

  return (
    <aside
      className={className}
      style={{
        width:'100%',
        height: "auto",
        maxHeight: "80vh",
        minHeight: "80vh",
        background: "#0f0f12",
        color: "#e6e6e6",
        gridTemplateColumns: "1fr 8fr 1fr",
        display: "grid",
        ...style,
      }}
    >
      <div></div>
      <div style={{
            height: "100%",
            gridTemplateRows: "auto auto 1fr auto",
            display: "grid",
            borderRadius: 10,
            borderRight: "1px solid #22232a",
            borderTop: "1px solid #22232a",
            borderLeft: "1px solid #22232a",
            borderBottom: "1px solid #22232a",
      }}>
        <div
          style={{
            padding: "14px 12px 8px",
            borderBottom: "1px solid #1c1d23",
          }}
        >
          <div style={{ fontWeight: 700 }}>Selection</div>
          <div style={{ fontSize: 12, color: "#a0a4b0" }}>
            {selected.length} item{selected.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            borderBottom: "1px solid #1c1d23",
          }}
        >
          <button
            onClick={onViewSelection}
            disabled={!hasAny}
            style={{
              flex: 1,
              background: hasAny ? "#2c62ff" : "#2a2d36",
              color: "#fff",
              border: "none",
              padding: "8px 10px",
              borderRadius: 8,
              cursor: hasAny ? "pointer" : "default",
            }}
          >
            View selection
          </button>
          <button
            onClick={onClear}
            disabled={!hasAny}
            style={{
              background: "transparent",
              color: hasAny ? "#bbb" : "#555",
              border: "1px solid #2a2d36",
              padding: "8px 10px",
              borderRadius: 8,
              cursor: hasAny ? "pointer" : "default",
            }}
          >
            Clear
          </button>
        </div>

        <div style={{ overflowY: "scroll", maxHeight: "60vh" }}>
          {selected.map((rec) => (
            <div
              key={rec.station_id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                alignItems: "center",
                padding: "10px 12px",
                borderBottom: "1px solid #1c1d23",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {rec.station_id}
                  {rec.station_name ? ` — ${rec.station_name}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "#a0a4b0", marginTop: 2 }}>
                  {rec.timezone ?? "—"}
                  {rec.station_network ? ` • ${rec.station_network}` : ""}
                </div>
              </div>
              <button
                onClick={() => onRemove(rec.station_id)}
                title="Remove from selection"
                style={{
                  background: "transparent",
                  color: "#c9ced8",
                  border: "1px solid #2a2d36",
                  padding: "6px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: 12,
            borderTop: "1px solid #1c1d23",
            fontSize: 12,
            color: "#a0a4b0",
          }}
        >
          Tip: Use the "Add" button in the results list to build a
          set, then click "View selection" to plot them together.
        </div>
      </div>
      <div></div>
    </aside>
  );
}
