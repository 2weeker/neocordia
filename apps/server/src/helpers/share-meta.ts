// Link previews (Discord, Twitter/X, Slack, Telegram...) come from crawlers
// that read the HTML and never run the bundle, so the server writes the
// Open Graph / Twitter card tags into index.html itself (http/interface).
//
// Image fallback: share banner -> logo -> default logo. Uploaded images get
// the large card; the bundled 192px logo is below Twitter's minimum for a
// large card, so it gets the small one.

type TShareSettings = {
  name: string;
  description: string | null;
  logo: { name: string } | null;
  shareBanner: { name: string } | null;
};

type TShareOptions = {
  // absolute origin crawlers can fetch from (CAESAR_SITE)
  origin: string;
  // the URL carries ?invite=: wording only, the code never goes in
  invite: boolean;
};

const APP_NAME = 'Caesar';
const THEME_COLOR = '#171717';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

const resolveImage = (settings: TShareSettings, origin: string) => {
  const uploaded = settings.shareBanner ?? settings.logo;

  if (uploaded) {
    return {
      url: `${origin}/public/${encodeURIComponent(uploaded.name)}`,
      large: true
    };
  }

  return { url: `${origin}/logo.png`, large: false };
};

const resolveDescription = (settings: TShareSettings, invite: boolean) => {
  if (invite) return `You've been invited to join ${settings.name}.`;

  return (
    settings.description?.trim() || `Join ${settings.name} on ${APP_NAME}.`
  );
};

const renderShareMeta = (
  html: string,
  settings: TShareSettings,
  { origin, invite }: TShareOptions
) => {
  const title = escapeHtml(settings.name);
  const description = escapeHtml(resolveDescription(settings, invite));
  const image = resolveImage(settings, origin);
  const imageUrl = escapeHtml(image.url);

  const tags = [
    ['name', 'description', description],
    ['name', 'theme-color', THEME_COLOR],
    ['property', 'og:type', 'website'],
    ['property', 'og:url', escapeHtml(`${origin}/`)],
    ['property', 'og:site_name', title],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:image', imageUrl],
    ['name', 'twitter:card', image.large ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', imageUrl]
  ]
    .map(([attr, key, value]) => `<meta ${attr}="${key}" content="${value}" />`)
    .join('\n    ');

  // function replacers: a "$&" in a server name must stay literal
  return html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`)
    .replace('</head>', () => `    ${tags}\n  </head>`);
};

export { renderShareMeta, type TShareSettings };
