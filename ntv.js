import { defineExtension } from 'azot';

export default defineExtension({
  async fetchContentMetadata(url) {
    const pageResponse = await fetch(url);
    const pageBody = await pageResponse.text();
    const videoMetadataFeedLink = pageBody
      .split(`<meta property="ya:ovs:feed_url" content="`)[1]
      ?.split(`">`)[0]
      ?.split(`" />`)[0];

    if (!videoMetadataFeedLink) {
      const pathname = new URL(url).pathname;
      if (pathname.includes('/serial')) {
        const parts = pageBody.split('href="/serial');
        const results = [];
        for (const part of parts) {
          if (!part.startsWith('/')) continue;
          const route = part.split('"')[0];
          if (
            !route ||
            route.length <= 1 ||
            route.includes('/issues/') ||
            route.includes('/about/') ||
            route.split('/').length <= 2
          )
            continue;
          const episodeUrl = url.replace(pathname, `/serial${route}`);
          const [metadata] = await this.fetchContentMetadata(episodeUrl);
          if (metadata) results.push(metadata);
        }
        return results;
      } else {
        console.error('Could not find video link in the page.');
        return [];
      }
    }

    const videoId = videoMetadataFeedLink.split(`video/`)[1]?.split(`/`)[0];
    const xmlUrl = `https://www.ntv.ru/vi${videoId}/`;
    const xmlResponse = await fetch(xmlUrl);
    const xmlBody = await xmlResponse.text();

    const getTagContent = (tagName) =>
      xmlBody.split(`<${tagName}>`)[1]?.split(`</${tagName}>`)[0]?.split(`DATA[`)[1]?.split(`]`)[0]?.trim();

    const fileLink = getTagContent('file') || getTagContent('video');
    const hqFileLink = getTagContent('hifile') || getTagContent('hd_video');
    const title = xmlBody.split(`<embed_tag>`)[1]?.split(`</embed_tag>`)[0];
    const name = pageBody.split('"name":"')[1]?.split('"')[0];
    const episodeNumberString = name?.includes('серия') ? name.split('-')[0] : undefined;
    const episodeNumber = episodeNumberString ? parseInt(episodeNumberString) : undefined;
    const subtitlesRoute = xmlBody.split(`<subtitles>`)[1]?.split(`</subtitles>`)[0];
    const subtitlesUrl = `https://www.ntv.ru${subtitlesRoute}`;
    const pathname = new URL(hqFileLink || fileLink).pathname;
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1).split('.')[0];
    if (subtitlesRoute) console.debug(`Subtitles: ${subtitlesUrl}`);
    const subtitles = [{ url: subtitlesUrl, format: subtitlesUrl.split('.').pop(), language: 'ru' }];
    return [
      {
        title,
        seasonNumber: episodeNumber ? 1 : undefined,
        episodeNumber,
        source: { url: hqFileLink || fileLink, subtitles },
      },
    ];
  },
});
