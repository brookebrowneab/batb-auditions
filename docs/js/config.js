/**
 * Show-specific configuration.
 * To reuse for a different show: update these values, swap the hero image,
 * and populate a new Google Sheet. Push. Done.
 */
export const config = {
  showTitle: 'Beauty and the Beast',
  showSubtitle: 'Audition Practice Tracks',
  schoolName: 'School Name Middle School',

  // Publish your Google Sheet: File → Share → Publish to web → CSV
  // Paste the URL here. Leave empty to use the local clips.json fallback.
  sheetCsvUrl: '',

  // JSONBin.io bin ID for cloud publishing (admin pushes, students read).
  // Create a bin at jsonbin.io, paste its ID here. Leave empty to skip cloud.
  jsonBinId: '699d5d5943b1c97be998dfe8',

  contactEmail: 'adcatheatreinfo@gmail.com',
  heroImage: './img/rose.svg',

  // Simple password gate for admin page (not truly secure — just prevents students from wandering in)
  adminPassword: 'batb2026',
};
