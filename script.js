const API_ENDPOINT = 'https://www.tikwm.com/api/';

let currentVideoData = null;
let abortController = null;
let debounceTimer = null;

const elements = {
    videoUrl: document.getElementById('videoUrl'),
    downloadBtn: document.getElementById('downloadBtn'),
    result: document.getElementById('result'),
    error: document.getElementById('error'),
    videoTitle: document.getElementById('videoTitle'),
    videoAuthor: document.getElementById('videoAuthor'),
    contentType: document.getElementById('contentType'),
    downloadVideo: document.getElementById('downloadVideo'),
    previewBtn: document.getElementById('previewBtn'),
    copyVideoLink: document.getElementById('copyVideoLink'),
    videoOptions: document.getElementById('videoOptions'),
    photoGallery: document.getElementById('photoGallery'),
    photoGrid: document.getElementById('photoGrid'),
    previewModal: document.getElementById('previewModal'),
    previewVideo: document.getElementById('previewVideo'),
    previewSource: document.getElementById('previewSource'),
    modalClose: document.querySelector('.modal-close'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    main: document.querySelector('.main'),
    header: document.querySelector('.header'),
    container: document.querySelector('.container')
};

// Event Listeners
elements.downloadBtn.addEventListener('click', handleDownload);
elements.videoUrl.addEventListener('keypress', handleKeyPress);
elements.videoUrl.addEventListener('input', handleInputChange);
elements.videoUrl.addEventListener('paste', handlePaste);
elements.downloadVideo?.addEventListener('click', handleVideoDownload);
elements.previewBtn?.addEventListener('click', handlePreviewClick);
elements.copyVideoLink?.addEventListener('click', handleCopyClick);
elements.modalClose?.addEventListener('click', closePreview);
elements.previewModal?.addEventListener('click', handleModalClick);
document.addEventListener('keydown', handleEscapeKey);

// Theme Change Listener for Favicon
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
        const [href] = favicon.getAttribute('href').split('?');
        favicon.href = `${href}?t=${Date.now()}`;
    }
});

function handleKeyPress(e) {
    if (e.key === 'Enter') {
        handleDownload();
    }
}

function handleInputChange() {
    if (elements.videoUrl.classList.contains('error')) {
        hideError();
    }
}

function handleVideoDownload(e) {
    if (currentVideoData?.videoUrl) {
        e.preventDefault();
        downloadMedia(currentVideoData.videoUrl, `tiktok_${Date.now()}.mp4`);
    }
}

function handlePaste(e) {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(function() {
        const pastedText = e.clipboardData.getData('text');
        if (pastedText && isValidTikTokUrl(pastedText.trim())) {
            handleDownload();
        }
    }, 500);
}

function handlePreviewClick() {
    if (currentVideoData?.videoUrl) {
        openPreview(currentVideoData.videoUrl);
    }
}

function handleCopyClick() {
    if (currentVideoData?.videoUrl) {
        copyToClipboard(currentVideoData.videoUrl, elements.copyVideoLink);
    }
}

function handleModalClick(e) {
    if (e.target === elements.previewModal || e.target.classList.contains('modal-backdrop')) {
        closePreview();
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape' && elements.previewModal?.classList.contains('active')) {
        closePreview();
    }
}

// Main Functions
async function handleDownload() {
    const url = elements.videoUrl.value.trim();

    if (!url) {
        showError('Please enter a TikTok URL');
        return;
    }

    if (!isValidTikTokUrl(url)) {
        showError('Please enter a valid TikTok URL');
        return;
    }

    if (abortController) {
        abortController.abort();
    }

    abortController = new AbortController();

    hideError();
    hideResult();
    setLoading(true);

    try {
        const videoData = await fetchTikTokData(url);
        displayResult(videoData);
    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }
        showError(error.message || 'An error occurred. Please try again.');
        console.error('Download error:', error);
    } finally {
        setLoading(false);
        abortController = null;
    }
}

async function fetchTikTokData(url) {
    const apiUrl = `${API_ENDPOINT}?url=${encodeURIComponent(url)}&hd=1`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error('Failed to fetch content data');
        }

        const result = await response.json();

        if (result.code !== 0) {
            throw new Error(result.msg || 'Failed to fetch content');
        }

        const isPhoto = result.data.images && result.data.images.length > 0;

        return {
            title: result.data.title || 'TikTok Content',
            author: result.data.author?.unique_id || result.data.author?.nickname || '@tiktok',
            thumbnail: result.data.cover || result.data.origin_cover,
            videoUrl: isPhoto ? null : (result.data.hdplay || result.data.play || result.data.wmplay),
            images: isPhoto ? result.data.images : null,
            isPhoto: isPhoto,
            duration: result.data.duration
        };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Unable to fetch content. Please check the URL and try again.');
    }
}

function isValidTikTokUrl(url) {
    const patterns = [
        /tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /tiktok\.com\/.*\/video\/\d+/,
        /tiktok\.com\/@[\w.-]+\/photo\/\d+/,
        /tiktok\.com\/.*\/photo\/\d+/,
        /vm\.tiktok\.com\/[\w-]+/,
        /vt\.tiktok\.com\/[\w-]+/,
        /tiktok\.com\/t\/[\w-]+/
    ];

    return patterns.some(function(pattern) {
        return pattern.test(url);
    });
}

function displayResult(data) {
    currentVideoData = data;

    elements.videoTitle.textContent = data.title || 'TikTok Content';

    // Add @ prefix if not already present
    const author = data.author || 'tiktok';
    elements.videoAuthor.textContent = author.startsWith('@') ? author : `@${author}`;

    if (data.isPhoto) {
        elements.contentType.textContent = `PHOTO · ${data.images.length} IMAGES`;
        elements.videoOptions.classList.remove('active');
        elements.photoGallery.classList.add('active');
        displayPhotoGallery(data.images);
    } else {
        elements.contentType.textContent = 'VIDEO';
        elements.photoGallery.classList.remove('active');

        if (data.videoUrl) {
            elements.downloadVideo.href = data.videoUrl;
            elements.videoOptions.classList.add('active');
        } else {
            elements.videoOptions.classList.remove('active');
        }
    }

    elements.result.classList.add('active');

    setTimeout(function() {
        document.body?.classList.add('content-loaded');
    }, 100);
}

function displayPhotoGallery(images) {
    elements.photoGrid.innerHTML = '';

    images.forEach(function(imageUrl, index) {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Photo ${index + 1}`;
        img.loading = 'lazy';

        img.onload = function() {
            img.classList.add('loaded');
            photoItem.classList.add('loaded');
        };

        img.onerror = function() {
            photoItem.classList.add('error');
            console.error(`Failed to load image ${index + 1}`);
        };

        photoItem.appendChild(img);
        elements.photoGrid.appendChild(photoItem);

        photoItem.addEventListener('click', function() {
            if (!photoItem.classList.contains('error')) {
                openPhotoPreview(imageUrl);
            }
        });
    });
}

function openPhotoPreview(imageUrl) {
    elements.previewVideo.style.display = 'none';

    let imgPreview = document.getElementById('imagePreview');
    if (!imgPreview) {
        imgPreview = document.createElement('img');
        imgPreview.id = 'imagePreview';
        imgPreview.setAttribute('aria-label', 'Photo preview');
        elements.previewModal.querySelector('.modal-content').appendChild(imgPreview);
    }

    imgPreview.src = imageUrl;
    imgPreview.style.display = 'block';
    elements.previewModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    elements.previewModal.focus();
}

function openPreview(videoUrl) {
    const imgPreview = document.getElementById('imagePreview');
    if (imgPreview) {
        imgPreview.style.display = 'none';
    }

    elements.previewSource.src = videoUrl;
    elements.previewVideo.load();
    elements.previewVideo.style.display = 'block';
    elements.previewModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePreview() {
    elements.previewModal.classList.remove('active');
    elements.previewVideo.pause();
    elements.previewSource.src = '';
    document.body.style.overflow = 'auto';
}

async function downloadMedia(url, filename) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    showToast('Starting download...');

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        setTimeout(function() {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        }, 100);

        showToast('Download started!');
    } catch (error) {
        console.error('Download error:', error);
        if (isIOS) {
            showToast('iOS: Please long press to save', true);
            window.open(url, '_blank');
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.download = filename;
            a.click();
        }
    }
}

async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);

        const originalText = button.querySelector('.action-label').textContent;
        button.querySelector('.action-label').textContent = 'Copied!';
        button.classList.add('copied');

        showToast('Link copied to clipboard!');

        setTimeout(function() {
            button.querySelector('.action-label').textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy link', true);
    }
}

let toastTimer = null;

function showToast(message, isError = false) {
    if (toastTimer) {
        clearTimeout(toastTimer);
    }

    elements.toastMessage.textContent = message;
    elements.toast.classList.toggle('error', isError);
    elements.toast.classList.add('active');

    toastTimer = setTimeout(function() {
        elements.toast.classList.remove('active');
        toastTimer = null;
    }, 3000);
}

function hideResult() {
    elements.result.classList.remove('active');
}

function showError(message) {
    elements.videoUrl.classList.add('error');
    showToast(message, true);
}

function hideError() {
    elements.videoUrl.classList.remove('error');
}

function setLoading(isLoading) {
    elements.downloadBtn.disabled = isLoading;
    elements.downloadBtn.classList.toggle('loading', isLoading);
}
