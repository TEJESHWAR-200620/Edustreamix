function extractYouTubeUrl(rawLink) {
    if (!rawLink) return '';
    const text = String(rawLink).trim();
    const directUrlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (!directUrlMatch) return '';
    return directUrlMatch[0].replace(/[),.;]+$/g, '');
}

function getEmbeddedVideoUrl(link) {
    const sourceUrl = extractYouTubeUrl(link);
    if (!sourceUrl) return '';

    try {
        const parsedUrl = new URL(sourceUrl);
        const hostname = parsedUrl.hostname.replace(/^www\./, '');

        if (hostname === 'youtu.be') {
            const videoId = parsedUrl.pathname.replace('/', '');
            return videoId ? \https://www.youtube-nocookie.com/embed/\\ : '';
        }

        if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
            const videoId = parsedUrl.searchParams.get('v');
            if (videoId) {
                return \https://www.youtube-nocookie.com/embed/\\;
            }
            const listId = parsedUrl.searchParams.get('list');
            if (listId) {
                return \https://www.youtube-nocookie.com/embed/videoseries?list=\\;
            }
        }
    } catch (error) {
        return 'Error';
    }
    return '';
}

console.log(getEmbeddedVideoUrl('https://youtu.be/DB3k9d2z0YU'));
console.log(getEmbeddedVideoUrl('https://www.youtube.com/watch?v=DLnQ1E6_2kw'));
console.log(getEmbeddedVideoUrl('https://youtube.com/playlist?list=PLBlnK6fEyqRgMCUAGOsZP4mpzxOqPNI66'));
