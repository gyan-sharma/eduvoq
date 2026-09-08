# Wix extraction (`scripts/migrate-wix`)

Deterministic extract from the published-site snapshot at repo-root `chalknpencil-archive/` (gitignored). This worktree may not contain the archive; the scripts still run from the main workspace when `ARCHIVE_ROOT` points at it.

Do **not** git-add the archive.

## Layout

| Script | Input | Output |
| --- | --- | --- |
| `extract-posts.ts` | `rendered/chalknpencil__post__*.html` (fallback: wget HTML + `meta/sitemaps/blog-posts-sitemap.xml`) | `migration/posts.json` |
| `extract-pages.ts` | about / services / legal HTML in rendered or wget | `migration/pages.json` |
| `redirects.json` (repo root) | Wix path map including `/my-*` and `/account/my-*` | consumed by `next.config.ts`; reuse in Caddy at cutover |

`migration/*.json` is gitignored (68 posts of TipTap JSON is large). `src/content/blog.ts` keeps a 3-post editorial subset for deploys without the archive.

## Run

From the main repo (archive at `./chalknpencil-archive`):

```bash
pnpm migrate:wix
pnpm db:seed
```

From a worktree, or any checkout without the snapshot:

```bash
ARCHIVE_ROOT=/path/to/eduvoq/chalknpencil-archive pnpm migrate:wix
ARCHIVE_ROOT=/path/to/eduvoq/chalknpencil-archive pnpm db:seed
```

`pnpm db:seed` imports the 68 Wix posts when `migration/posts.json` exists **or** the archive is present (it will extract first). If both are missing it seeds the 3 sample posts and prints how to run this pipeline.

A later Wix import on a DB that already has those samples **archives** the three editorial slugs (`mastering-the-art-of-lesson-planning`, `nep-2020-in-the-classroom`, `staffroom-letter-a-quiet-professional-press`) so they are not published beside the 68 Wix posts. Member submissions are not deleted.

Pages are extracted for editorial review. Polished `CmsPage` seed in `src/content/cms.ts` is **not** overwritten unless `MIGRATE_CMS_PAGES=1` is set (Wix markup mixes poems and prose).

## Notes

- Cover URLs stay as `static.wixstatic.com` on each post (`coverImageUrl`). `fetch-media.ts` (later) downloads them into storage.
- Org-authored Wix posts are assigned the `eduvoq-editorial` user at seed time.
- Wix `/chalknpencil` prefixes are in `redirects.json` alongside the short paths.
