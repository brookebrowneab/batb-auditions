# Beauty and the Beast — Audition Practice App

A mobile-first web app for middle school students to practice audition songs. No build step, no dependencies — just HTML, CSS, and vanilla JavaScript served via GitHub Pages.

## How It Works

- **Audio**: MP3 files are hosted locally in `docs/audio/`. The app plays only the audition excerpt (start/end timestamps) from each full song.
- **Data**: Clip definitions live in `docs/data/clips.json` — a structured file with songs, parts (characters), and clips. Each clip references a song and can be assigned to multiple parts.
- **Hosting**: Served free via GitHub Pages from the `docs/` folder.
- **Privacy**: `robots.txt` blocks search engine indexing of audio files, and `<meta name="robots">` prevents page indexing. Keep the GitHub repo **private**.

## Quick Start

### 1. Set Up Audio Files

1. Download the MP3s from the shared Google Drive folder
2. Place them in two folders — same filenames in each:
   - `docs/audio/full/` — vocal tracks (with singing)
   - `docs/audio/instrumental/` — backing tracks (no vocals)

| File | Song |
|---|---|
| `02_Belle.mp3` | Belle (Opening) |
| `12_Home.mp3` | Home |
| `14_Gaston.mp3` | Me (Gaston's Song) |
| `15_Gaston_Reprise.mp3` | Gaston (Reprise) |
| `16_Be Our Guest.mp3` | Be Our Guest |
| `19_Something There.mp3` | Something There |
| `20_Human Again.mp3` | Human Again |
| `22_Beauty and the Beast.mp3` | Beauty and the Beast |
| `24_The Mob Song.mp3` | The Mob Song |

3. Commit and push (the repo must stay **private** on GitHub)

### 2. Configure the App

Edit `docs/js/config.js`:

```js
export const config = {
  showTitle: 'Beauty and the Beast',
  showSubtitle: 'Audition Practice Tracks',
  schoolName: 'Your School Name',
  sheetCsvUrl: '',  // Optional: Google Sheet CSV URL for live data
  contactEmail: 'music@yourschool.edu',
  heroImage: './img/rose.svg',
};
```

### 3. Deploy

Push to GitHub. Enable GitHub Pages:
1. **Settings** → **Pages** → Source: **Deploy from a branch**
2. Branch: `main`, Folder: `/docs`
3. Your site is live at `https://yourusername.github.io/batb-auditions/`

**Important**: Keep the repository **private** to prevent public access to the audio files. The `robots.txt` and `<meta name="robots">` tags block search engine indexing as an extra layer of protection.

## Updating Clips

1. Go to `your-site-url/admin.html` (the Admin Clip Builder)
2. Use the **Clips** tab to add, edit, or delete clips — adjust timestamps, assign parts, add notes
3. Use the **Parts** tab to add/rename characters (renaming cascades to all clips)
4. Use the **Songs** tab to edit song titles or register new MP3 files
5. Click **Export JSON** to download the updated `clips.json`
6. Replace `docs/data/clips.json` with the downloaded file
7. Commit and push

## Admin Clip Builder

Visit `your-site-url/admin.html` for a three-tab editor:

- **Clips**: Each clip has a song dropdown, start/end time controls with ±1s buttons, notes field, and part checkboxes. Preview any clip's audio. Add new clips or delete existing ones.
- **Parts**: Each part (character) has a color picker and name input. Renaming a part cascades to all clips. Delete is disabled if the part is in use.
- **Songs**: Edit song titles. Delete is disabled if clips reference the song. Add new songs for registering additional MP3 files.

The toolbar provides **Import JSON** (load a `clips.json` file) and **Export JSON** (download the current state).

## Google Sheet (Optional)

For live data updates without code changes, you can optionally use a Google Sheet. Create a sheet with columns: Character, Song, Full Track ID, Backing Track ID, Start, End, Notes, Color. Publish as CSV and set the URL in `config.js`. The app will prefer the sheet over the local JSON.

## Reusing for Another Show

1. Update `docs/js/config.js` with the new show title and contact email
2. Swap `docs/img/rose.svg` with a show-appropriate image
3. Place new MP3s in `docs/audio/full/` and `docs/audio/instrumental/`
4. Edit `docs/data/clips.json` (or use admin.html) to define new songs, parts, and clips
5. Push. Done.

## Project Structure

```
docs/
├── index.html          # Student-facing app
├── admin.html          # Admin Clip Builder (3-tab editor)
├── robots.txt          # Blocks search engine indexing of audio
├── css/styles.css      # All styles (mobile-first)
├── js/
│   ├── app.js          # Entry: init, fetch data, render
│   ├── config.js       # Show-specific configuration
│   ├── data.js         # JSON/CSV fetch, format detection, resolution
│   ├── player.js       # Audio engine: timestamp playback
│   ├── ui.js           # DOM rendering: cards, filters
│   └── admin.js        # Admin: clip builder + preview
├── audio/
│   ├── full/           # Vocal tracks (with singing)
│   └── instrumental/   # Backing tracks (no vocals)
├── data/clips.json     # Structured clip data (songs, parts, clips)
└── img/rose.svg        # Decorative header image
```

**~50KB total** (excluding audio). No npm. No build step. No dependencies.
