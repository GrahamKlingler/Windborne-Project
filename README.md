# Windborne Project

> *A data visualizer for Windborne systems weather stations*
> *Optional badges (build, license, etc.).*

---

## Overview

* **This app allows you to intuitively navigate and view data from weather stations around the globe**
* **Provides an clean map visualization tool for simple data analysis and a plain data view for more comprehensive analysis**
* **Key features: Globe view, Data Analysis view (single and multi), Caching system to limit API strain, optimized search engine for weather stations**

## Demo / Screenshots

* *GIF or screenshot links here.*

## Architecture

* **High-level diagram:**
* **Key modules:**

  * Rendering / 3D
  * Data access / caching
  * UI components
  * State management

## Tech Stack

* **Framework:**
* **Language:**
* **Build tool:**
* **3D / Visualization:**
* **Charts:**
* **Linting / formatting:**

## Prerequisites

* **Node / npm versions:**
* **System requirements:**

## Getting Started

### 1) Install

```bash
# commands
```

### 2) Development

```bash
# commands
```

### 3) Build

```bash
# commands
```

### 4) Test / Lint

```bash
# commands
```

## Environment Variables

* `VITE_...` – *description*
* *Add any API keys / endpoints here.*

## Project Structure

```
<root>/
  ├─ src/
  │   ├─ globe_vis/
  │   ├─ plain_view/
  │   ├─ components/
  │   ├─ data/
  │   └─ ...
  ├─ public/
  └─ ...
```

* **Notable files:**

  * `src/globe_vis/...` – *description*
  * `src/plain_view/...` – *description*
  * `src/StationDialog.tsx` – *description*
  * `src/MultiStationDialog.tsx` – *description*
  * `src/stationCache.ts` – *description*
  * `src/dataCache.ts` – *description*

## Data & APIs

* **Station list endpoint:** *URL + response shape*
* **Historical points endpoint:** *URL + response shape*
* **Any third‑party datasets:** *names + purpose*

## Caching Strategy

* **In-memory cache:** *what & why*
* **LocalStorage cache:** *TTL, keys, invalidation*
* **ETag / Last-Modified:** *usage*
* **Stale‑while‑revalidate (if any):** *notes*

---

# Globe View

### Displayed Geography

* **Datasets / sources:**
* **GeoJSON processing:**
* **Line rendering approach:**
* **Resolution handling:**

### Mapping the Stations

* **Station projection / coordinates:**
* **Point material & size strategy:**
* **Dynamic size vs zoom:**
* **Raycasting / picking:**
* **Occlusion (front hemisphere / globe mesh):**

### Interaction & Controls

* **Orbit controls settings (rotate/zoom/pan):**
* **Speed scaling with zoom:**
* **Tooltips / hover behavior:**
* **Click → open details:**

### Performance Notes

* **Buffer geometry sizes:**
* **Raycaster thresholds:**
* **Frame budget considerations:**

---

# Plain View

### Singular View

* **Purpose / UX:**
* **Dialog behavior (layout, close rules):**
* **Data normalization (time key, numeric series):**
* **Chart configuration (axes, tooltip, legend):**

### Multi‑View

* **Selection model (stations & variables):**
* **Dropdown multiselect UX:**
* **Series naming convention (e.g., `STATION_ID:variable`):**
* **Time alignment / merge strategy:**

### Search Engines

* **Search fields (ID, name, timezone, network):**
* **Indexing approach:**
* **Fuzzy / partial matching:**
* **Pagination / performance:**

### Additional Datasets

* **External sources:**
* **Overlay/compare strategy:**
* **Units & conversion:**
* **Attribution / licensing:**

---

## Components

* `GlobeStations` – *responsibilities*
* `Plain` – *responsibilities*
* `StationDialog` – *responsibilities*
* `MultiStationDialog` – *responsibilities*
* `SelectionSidebar` – *responsibilities*
* *Any utility components*

## Styling & Theming

* **Color system:**
* **Typography:**
* **Dark mode specifics:**

## Accessibility

* **Keyboard navigation:**
* **Contrast & focus states:**
* **ARIA roles for dialogs/tooltips:**

## Testing

* **Unit tests:**
* **Integration / UI tests:**
* **Mocking network / caches:**

## Deployment

* **Hosting target:**
* **Build output:**
* **CDN / asset strategy:**

## Troubleshooting

* **Common errors:**
* **Multiple React versions:**
* **WebGL context limits:**

## Roadmap

* [ ] *Item*
* [ ] *Item*
* [ ] *Item*

## Contributing

* **How to propose changes:**
* **Code style:**
* **PR checklist:**

## License

* *Name + link*
