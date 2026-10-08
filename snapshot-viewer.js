const photoSwipeBase = 'https://unpkg.com/photoswipe@5.4.4/dist/';
let viewerAssets;
let opening = false;

function loadViewer() {
  if (!viewerAssets) {
    const styles = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${photoSwipeBase}photoswipe.css`;
      link.onload = resolve;
      link.onerror = () => {
        link.remove();
        reject(new Error('Could not load image viewer styles'));
      };
      document.head.appendChild(link);
    });
    viewerAssets = Promise.all([
      import(`${photoSwipeBase}photoswipe.esm.min.js`),
      styles,
    ]);
  }
  return viewerAssets;
}

document.addEventListener('click', async (event) => {
  const link = event.target.closest('.icon-gallery a[data-pswp-width]');
  if (!link || event.defaultPrevented || event.button !== 0
      || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  if (opening) return;
  opening = true;

  try {
    const [{ default: PhotoSwipe }] = await loadViewer();
    const image = link.querySelector('img');
    const viewer = new PhotoSwipe({
      dataSource: [{
        src: link.href,
        width: Number(link.dataset.pswpWidth),
        height: Number(link.dataset.pswpHeight),
        alt: image.alt,
        msrc: image.currentSrc || image.src,
      }],
      showHideAnimationType: 'fade',
    });
    viewer.init();
  } catch (error) {
    viewerAssets = undefined;
    console.warn('Opening the full-size image without the viewer.', error);
    window.location.assign(link.href);
  } finally {
    opening = false;
  }
});
