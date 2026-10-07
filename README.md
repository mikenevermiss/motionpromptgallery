# MotionPromptGallery

Live: https://motionpromptgallery.vercel.app

Motion graphics made with frontier AI models, next to the prompts that made them.
Covers Claude Opus 5.5, Kimi K3, Claude Fable 5 and GPT-6 Astra.

Built with Next.js 15 (App Router, `output: 'export'`), React 19, Tailwind CSS 3 and Geist. The build is fully static, so `out/` can go on any static host (Vercel, Netlify, Cloudflare Pages, S3).

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static site in out/ (prebuild generates public/data/)
npm start            # serve out/ locally
npm run screenshots  # headless Chromium screenshots of out/ into screenshots/
```

## Content

- `data/items.json`: every entry. Fields: id, title, slug, model, type (`prompt` | `skill`), creatorName, handle, postUrl, postedAt, stack, prompt, code, tags, video, poster, aspectRatio, sourceNote.
- `public/videos/*.mp4` and `public/posters/*`: media referenced by `video` and `poster`.
- `data/leads.md`: pieces we found but couldn't add yet (no verbatim prompt, unreadable source, and so on).

### Add entries

```bash
npm run add-item -- path/to/new.json            # an object or an array
npm run add-item -- path/to/new.csv --dry-run   # validate first (see data/example-new-items.csv)
npm run validate                                # check the whole dataset
```

The script normalizes model names, generates slugs and ids, probes aspect ratios with ffprobe, rejects duplicates, and checks that media files exist.

**Editorial rule:** only add real pieces. Each one needs the real source URL and the creator's actual prompt text (or a skill name and link). Every piece belongs to its creator.

## Before launch

- The contact address lives in `lib/site.ts` (`contactEmail`). It's used by the footer's "request removal" and "submit a piece" mailto links.
- Set `NEXT_PUBLIC_SITE_URL` if you deploy somewhere other than https://motionpromptgallery.com.

## License

The code is open source under the [MIT License](LICENSE).

The gallery content (prompts, code samples, videos and posters) is **not** covered by that license. Every piece belongs to the creator credited on its entry, with a link to the original post. Creators can request removal at mikenevermis@gmail.com, or by opening an issue.

## Contributing

Found a motion piece made with one of these models, with its prompt published? Open a PR that adds it to `data/items.json` (use `npm run add-item`) with the real source URL and the creator's verbatim prompt.
