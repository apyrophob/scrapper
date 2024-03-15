const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const SELECTORS = {
    OPEN_MODAL_BUTTON: 'button[class*="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d LQeN7 aLey0c"]',
    OPEN_SORT_SELECT: '#sortBy_1',
    OPTION: 'div[data-filter-id="sortBy_2"]',
    MODAL_SCROLLABLE: '.fysCi',
    REVIEW: '.RHo1pe',
    NAME: '.X5PpBb',
    COMMENT: '.h3YV2d',
    RATE: '.iXRFPc',
    DATE: '.bp9Aid'
};

const CHUNK_SIZE = 200;
const FILENAME = './uploads/reviews.json';

const initBrowser = async (url) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    return { browser, page };
};

const onClickSelector = async (page, selector) => {
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
    await page.click(selector);
};

const scrollPage = async (page, selector) => {
    await page.evaluate((selector) => {
        const modalScrollable = document.querySelector(selector);
        modalScrollable.scrollTop = modalScrollable.scrollHeight;
    }, selector);
};

const getReviews = async (page) => {
    return await page.$$eval(SELECTORS.REVIEW, (nodes, SELECTORS) => nodes.map(node => {
        const name = node.querySelector(SELECTORS.NAME)?.textContent || '';
        const comment = node.querySelector(SELECTORS.COMMENT)?.textContent || '';
        const rateString = node.querySelector(SELECTORS.RATE)?.getAttribute('aria-label') || '';
        const rate = rateString.match(/\d+/) ? rateString.match(/\d+/)[0] : '';
        const date = node.querySelector(SELECTORS.DATE)?.textContent || '';

        return { name, comment, rate, date };
    }), SELECTORS);
};

const addNewReviews = (reviews, newReviews) => {
    return [...reviews, ...newReviews.filter(newReview => !reviews.some(review => review.comment === newReview.comment))];
};

const sortReviewsByDate = (reviews) => {
    return reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

const appendReviewsFile = async (reviews) => {
    await fs.appendFile(FILENAME, JSON.stringify(reviews, null, 2) + ',\n');
};

const scrapeReviews = async (url, numberOfReviews) => {
    let reviews = [];
    const { browser, page } = await initBrowser(url);
    await onClickSelector(page, SELECTORS.OPEN_MODAL_BUTTON);
    await delay(500);
    await onClickSelector(page, SELECTORS.OPEN_SORT_SELECT);
    await delay(500);
    await onClickSelector(page, SELECTORS.OPTION);
    await delay(500);

    let previousReviewCount = 0;
    let sameCount = 0;

    while (reviews.length < numberOfReviews) {
        const newReviews = await getReviews(page);
        reviews = addNewReviews(reviews, newReviews);

        if (reviews.length === previousReviewCount) {
            sameCount++;
            if (sameCount >= 3) break;
        } else {
            sameCount = 0;
        }

        previousReviewCount = reviews.length;
        await scrollPage(page, SELECTORS.MODAL_SCROLLABLE);
        await delay(500);

        if (reviews.length >= CHUNK_SIZE) {
            const sortedReviews = sortReviewsByDate(reviews.slice(-CHUNK_SIZE));
            await appendReviewsFile(sortedReviews);
            console.log(`Scraped ${reviews.length} reviews`);
            reviews = reviews.slice(0, -CHUNK_SIZE);
        }
    }

    await browser.close();
    return reviews;
};

const url = 'https://play.google.com/store/apps/details?id=com.spotify.music&hl=en&gl=US';

console.time('Scraping Time');

scrapeReviews(url, 300)
    .then(() => console.timeEnd('Scraping Time'))
    .catch(console.error);