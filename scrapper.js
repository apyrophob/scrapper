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

const FILENAME = './uploads/reviews.jsonl';
const stream = fs.createWriteStream(FILENAME, {flags:'a'});

const initBrowser = async (url) => {
    const browser = await puppeteer.launch({
        //uncomment the line below to see the browser in action
        // headless: false,
    });
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

const getReviews = async (page, startIndex, max) => {
    const reviews = [];
    for (let i = startIndex; i < max; i++) {
        const reviewNode = await page.$(`${SELECTORS.REVIEW}:nth-child(${i + 1})`);

        if (!reviewNode) break;

        const name = await reviewNode.$eval(SELECTORS.NAME, node => node.textContent).catch(() => '');
        const comment = await reviewNode.$eval(SELECTORS.COMMENT, node => node.textContent).catch(() => '');
        const rateString = await reviewNode.$eval(SELECTORS.RATE, node => node.getAttribute('aria-label')).catch(() => '');
        const rate = rateString.match(/\d+/) ? rateString.match(/\d+/)[0] : '';
        const date = await reviewNode.$eval(SELECTORS.DATE, node => node.textContent).catch(() => '');

        reviews.push({ name, comment, rate, date });
    }

    return reviews;
};

const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

const scrapeReviews = async (url, max) => {
    const { browser, page } = await initBrowser(url);
    await onClickSelector(page, SELECTORS.OPEN_MODAL_BUTTON);
    await delay(500);

    await onClickSelector(page, SELECTORS.OPEN_SORT_SELECT);
    await delay(500);

    await onClickSelector(page, SELECTORS.OPTION);
    await delay(500);

    let totalReviewsCount = 0;
    
    while (totalReviewsCount < max) {
        console.time('Scraping Time');
        const newReviews = await getReviews(page, totalReviewsCount, totalReviewsCount + 20);
        newReviews.forEach(review => stream.write(JSON.stringify(review) + '\n'));
        totalReviewsCount += newReviews.length;
        console.log(`Added ${totalReviewsCount} reviews to the file.`);

        await scrollPage(page, SELECTORS.MODAL_SCROLLABLE);
        console.timeEnd('Scraping Time');
    }

    stream.end();
    await browser.close();
};

const url = 'https://play.google.com/store/apps/details?id=com.spotify.music&hl=en&gl=US';

scrapeReviews(url, 10000)
    .catch(console.error);