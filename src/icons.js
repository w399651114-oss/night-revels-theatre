const paths = {
  theatre: '<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15m6-12v15"/>',
  wave: '<path d="M2 12h2m3-5v10m4-14v18m4-15v12m4-9v6m2-3h1"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  book: '<path d="M3 5q5-2 9 2 4-4 9-2v14q-5-2-9 2-4-4-9-2zM12 7v14"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zM15 8q4 4 0 8m3-11q7 7 0 14"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',
  full: '<path d="M8 3H3v5m13-5h5v5m0 8v5h-5M3 16v5h5"/>',
  pin: '<path d="M18 9c0 4-6 10-6 10s-6-6-6-10a6 6 0 1 1 12 0z"/><circle cx="12" cy="9" r="2"/>',
  grid: '<path d="m4 7 8-4 8 4v10l-8 4-8-4zm0 0 8 4 8-4m-8 4v10"/>',
  eye: '<path d="M2 12q10-14 20 0-10 14-20 0z"/><circle cx="12" cy="12" r="3"/>',
  sliders:
    '<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  ribbon: '<path d="M3 7h18M3 17h18M5 4v16m14-16v16"/>',
  close: '<path d="m5 5 14 14m0-14L5 19"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  left: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6"/>',
  aim: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  rec: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-4v12l-6-4"/>',
  download: '<path d="M12 3v11m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
};
export const icon = (name, size = 18) =>
  '<svg aria-hidden="true" width="' +
  size +
  '" height="' +
  size +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">' +
  paths[name] +
  "</svg>";
