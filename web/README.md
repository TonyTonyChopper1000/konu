# Telangana Land Data Inventory (Vite app)

A local dashboard of what the four crawler zips contain, with tabs for Overview, Bhubharati, HMDA, TGRAC GIS, Govt websites, All files and the coverage checklist.

It reads the summary CSVs in `../dashboard/data/` and bundles them at build time. Vanilla JS + d3, no framework.

```bash
cd web
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build     # static site in web/dist (open with: npm run preview)
```

To refresh the numbers, rebuild the CSVs with `dashboard/scripts/build.py` (see `dashboard/README.md`), then restart `npm run dev` or rebuild. `dashboard/data/checklist.csv` is edited by hand.
