# Telangana Land Data Inventory

Scripts and summary data behind the dashboard at https://claude.ai/artifact/VgYne8FnC26asYNjWH3itZ

## Rebuild the summaries

Extract each zip into its own folder under a data directory, then run:

```bash
mkdir -p data out
for z in *.zip; do unzip -o -q "$z" -d "data/${z%.zip}"; done
python3 dashboard/scripts/profile.py data profile.json
python3 dashboard/scripts/build.py data out profile.json
```

- `profile.py` lists every CSV with its row count, columns and two sample rows (`profile.json`).
- `build.py` writes the summary CSVs used by the dashboard into `out/`.

## Files in `data/`

| File | What it is |
|---|---|
| `inventory.csv` | One row per CSV in the four zips: rows, columns, size, column names |
| `bhu_districts.csv` | Bhubharati mandals, villages, survey numbers and SRO offices per district |
| `hmda_registers.csv` | Records per HMDA approval register, with first and last year |
| `hmda_by_year.csv` | Building, layout and single-window approvals per year |
| `tgrac_folders.csv` | TGRAC ArcGIS catalogue per folder: layers, features, how many were downloaded |
| `tgrac_geometry.csv` | TGRAC layers by geometry type |
| `sites.csv` | Pages, documents and tables per crawled website |
| `checklist.csv` | Coverage checklist: items the KONU property-intelligence source directory expects, marked Yes/No (written by hand, not by `build.py`) |

`index.html` is a copy of the claude.ai dashboard page code; it only runs inside that dashboard. For a version that runs locally, see the Vite app in `../web/`.
