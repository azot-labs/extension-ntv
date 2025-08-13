import { defineExtension } from 'azot';

export default defineExtension({
  async fetchContentMetadata(url) {
    const pageResponse = await fetch(url);
    const pageBody = await pageResponse.text();
    const videoFrameLink = pageBody
      .split(`<meta property="og:video:iframe" content="`)[1]
      ?.split(`">`)[0]
      ?.split(`" />`)[0];

    if (!videoFrameLink) {
      const pathname = new URL(url).pathname;
      if (pathname.includes('/serial')) {
        const parts = pageBody.split('wide-card-video" href="');
        const results = [];
        for (const part of parts) {
          if (!part.startsWith('/')) continue;
          const route = part.split('"')[0];
          if (!route) continue;
          const episodeUrl = url.replace(pathname, route);
          const [metadata] = await this.fetchContentMetadata(episodeUrl);
          if (metadata) results.push(metadata);
        }
        return results;
      } else {
        console.error('Could not find video link in the page.');
        return [];
      }
    }

    const videoId = videoFrameLink.split(`embed/`)[1]?.split(`/`)[0];
    const xmlResponse = await fetch(`https://www.ntv.ru/vi${videoId}/`);
    const xmlBody = await xmlResponse.text();
    const fileLink = xmlBody.split(`<file>`)[1]?.split(`</file>`)[0]?.split(`DATA[`)[1]?.split(`]`)[0];
    const title = xmlBody.split(`<embed_tag>`)[1]?.split(`</embed_tag>`)[0];
    const name = pageBody.split('"name":"')[1]?.split('"')[0];
    const episodeNumberString = name?.includes('серия') ? name.split('-')[0] : undefined;
    const episodeNumber = episodeNumberString ? parseInt(episodeNumberString) : undefined;
    const subtitlesRoute = xmlBody.split(`<subtitles>`)[1]?.split(`</subtitles>`)[0];
    const subtitlesUrl = `https://www.ntv.ru${subtitlesRoute}`;
    const hqFileLink = fileLink.replace(`vod/`, `vod/hd/`).replace(`_lo.mp4`, `.mp4`);
    const pathname = new URL(hqFileLink).pathname;
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1).split('.')[0];
    if (subtitlesRoute) console.debug(`Subtitles: ${subtitlesUrl}`);
    const subtitles = [{ url: subtitlesUrl, format: subtitlesUrl.split('.').pop(), language: 'ru' }];
    return [
      {
        title,
        seasonNumber: episodeNumber ? 1 : undefined,
        episodeNumber,
        source: { url: hqFileLink, subtitles },
      },
    ];
  },
});
