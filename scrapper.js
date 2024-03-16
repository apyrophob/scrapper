const puppeteer = require('puppeteer');
const fs = require('fs');

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

const FILENAME = './uploads/reviews.json';
const stream = fs.createWriteStream(FILENAME, {flags:'a'});

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

const getReviews = async (page, startIndex) => {
    return await page.$$eval(SELECTORS.REVIEW, (nodes, SELECTORS, startIndex) => nodes.slice(startIndex).map(node => {
        const name = node.querySelector(SELECTORS.NAME)?.textContent || '';
        const comment = node.querySelector(SELECTORS.COMMENT)?.textContent || '';
        const rateString = node.querySelector(SELECTORS.RATE)?.getAttribute('aria-label') || '';
        const rate = rateString.match(/\d+/) ? rateString.match(/\d+/)[0] : '';
        const date = node.querySelector(SELECTORS.DATE)?.textContent || '';

        return { name, comment, rate, date };
    }), SELECTORS, startIndex);
};

const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

const removeDuplicatesFromFile = async () => {
    try {
        const data = await fs.readFile(FILENAME, 'utf8');
        const reviews = JSON.parse(data);
        const uniqueReviews = Array.from(new Set(reviews.map(JSON.stringify))).map(JSON.parse);
        await fs.writeFile(FILENAME, JSON.stringify(uniqueReviews, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error: ${error}`);
    }
};

const scrapeReviews = async (url, max) => {
    const { browser, page } = await initBrowser(url);
    await onClickSelector(page, SELECTORS.OPEN_MODAL_BUTTON);
    await delay(500);

    await onClickSelector(page, SELECTORS.OPEN_SORT_SELECT);
    await delay(500);

    await onClickSelector(page, SELECTORS.OPTION);
    await delay(500);

    let totalReviewsCount = 0;
    let startIndex = 0;
    
    while (totalReviewsCount < max) {
        const newReviews = await getReviews(page, startIndex);
        startIndex += newReviews.length;
        newReviews.forEach(review => stream.write(`${JSON.stringify(review)},\n`));
        totalReviewsCount += newReviews.length;
        console.log(`Added ${totalReviewsCount} reviews to the file.`);

        await scrollPage(page, SELECTORS.MODAL_SCROLLABLE);
        await delay(1000);
    }

    stream.end();
    await browser.close();
    await removeDuplicatesFromFile();
};

const url = 'https://play.google.com/store/apps/details?id=com.spotify.music&hl=en&gl=US';

console.time('Scraping Time');

scrapeReviews(url, 1000)
    .then(() => console.timeEnd('Scraping Time'))
    .catch(console.error);