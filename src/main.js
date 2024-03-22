import { Actor, KeyValueStore } from 'apify';
import puppeteer from 'puppeteer';

const SELECTORS = {
    OPEN_MODAL_BUTTON: 'button[class*="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d LQeN7 aLey0c"]',
    OPEN_SORT_SELECT: '#sortBy_1',
    OPTION: 'div[data-filter-id="sortBy_2"]',
    MODAL_SCROLLABLE: '.fysCi',
    REVIEW: '.RHo1pe',
    NAME: '.X5PpBb',
    COMMENT: '.h3YV2d',
    RATE: '.iXRFPc',
    DATE: '.bp9Aid',
};

const initBrowser = async (url) => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    return { browser, page };
};

const onClickSelector = async (page, selector) => {
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
    await page.click(selector);
};

const scrollPage = async (page, scrollableSelector) => {
    await page.evaluate((selector) => {
        const modalScrollable = document.querySelector(selector);
        modalScrollable.scrollTop = modalScrollable.scrollHeight;
    }, scrollableSelector);
};

const getReviews = async (page, startIndex, max, store) => {
    for (let i = startIndex; i < max; i++) {
        const reviewNode = await page.$(`${SELECTORS.REVIEW}:nth-child(${i + 1})`);

        if (!reviewNode) break;

        const name = await reviewNode.$eval(SELECTORS.NAME, (node) => node.textContent).catch(() => '');
        const comment = await reviewNode.$eval(SELECTORS.COMMENT, (node) => node.textContent).catch(() => '');
        const rateString = await reviewNode.$eval(SELECTORS.RATE, (node) => node.getAttribute('aria-label')).catch(() => '');
        const rate = rateString.match(/\d+/) ? rateString.match(/\d+/)[0] : '';
        const date = await reviewNode.$eval(SELECTORS.DATE, (node) => node.textContent).catch(() => '');

        const review = { name, comment, rate, date };
        await store.setValue(`review-${i}`, review);
    }
};

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

const scrapeReviews = async (url, reviewsCount) => {
    const { browser, page } = await initBrowser(url);
    const store = await KeyValueStore.open('reviews-store');

    await onClickSelector(page, SELECTORS.OPEN_MODAL_BUTTON);
    await delay(500);

    await onClickSelector(page, SELECTORS.OPEN_SORT_SELECT);
    await delay(500);

    await onClickSelector(page, SELECTORS.OPTION);
    await delay(500);

    let totalReviewsCount = 0;

    while (totalReviewsCount < reviewsCount) {
        await getReviews(page, totalReviewsCount, totalReviewsCount + 20, store);
        totalReviewsCount += 20;

        await scrollPage(page, SELECTORS.MODAL_SCROLLABLE);
        await delay(500);
    }

    await browser.close();
};

const main = async () => {
    await Actor.init();
    const input = await Actor.getInput();
    const { reviewsCount, startUrls } = input;
    const { url } = startUrls[0];

    await scrapeReviews(url, reviewsCount);

    await Actor.exit();
};

main();
