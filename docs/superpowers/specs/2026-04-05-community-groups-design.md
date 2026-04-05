# CH Community Groups Directory

**Date:** 2026-04-05
**Status:** Working independently

## Summary

A curated directory of cluster headache patient support groups worldwide. Searchable, filterable by region/platform, with group cards showing name, country, platform, description, link, and language.

## Data

Static JSON file at `src/data/community-groups.json`. Manually curated — no API exists for this. Easy to edit and expand.

### Per-group schema:
```json
{
  "name": "ClusterBusters",
  "country": "US",
  "region": "north-america",
  "platform": "website",
  "url": "https://clusterbusters.org",
  "language": "en",
  "description": "The largest online CH community. Forum, research advocacy, annual conference.",
  "members": "10,000+",
  "tags": ["forum", "advocacy", "research"]
}
```

## Page Structure

New top-level nav item: Home | ClusterBusters | Research | **Community**

Route: `/community`

### Layout
1. Hero: title + description + total group count
2. Filters: region pills + platform pills (same style as research/trials pages)
3. Groups grid: cards grouped by region, each with flag emoji, platform icon, description, link

### Filters
- **Region:** All, Europe, North America, Asia-Pacific, South America, Other
- **Platform:** All, Website, Facebook, Reddit, Discord, Other

## Sources to Search

1. ClusterBusters.org affiliates
2. OUCH chapters (UK, US, NL, AU)
3. European Headache Federation member orgs
4. Facebook group search
5. Reddit communities
6. Country-specific headache associations
7. Web search per country/region
