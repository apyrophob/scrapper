const puppeteer = require('puppeteer');
const moment = require('moment');
const fs = require('fs');

const OPEN_MODAL_BUTTON_SELECTOR = 'button[class*="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d LQeN7 aLey0c"]';
const OPEN_SORT_SELECT_SELECTOR = '#sortBy_1';
const OPTION_SELECTOR = 'div[data-filter-id="sortBy_2"]';
const MODAL_SCROLLABLE_SELECTOR = '.fysCi';
const REVIEW_SELECTOR  = '.RHo1pe';
const NAME_SELECTOR  = '.X5PpBb';
const COMMENT_SELECTOR  = '.h3YV2d';
const RATE_SELECTOR  = '.iXRFPc';
const DATE_SELECTOR  = '.bp9Aid';

const initBrowser = async (url) => {
    const browser = await puppeteer.launch({ 
        // uncomment to see the browser
        // headless: false, 
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    return { browser, page };
};

const onClickSelector = async (page, selector) => {
    try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.click(selector);
    } catch (error) {
        console.error(error);
    }
};

const scrollPage = async (page, selector) => {
    await page.evaluate((selector) => {
        const modalScrollable = document.querySelector(selector);
        if (modalScrollable) {
            modalScrollable.scrollTop = modalScrollable.scrollHeight;
        } else {
            console.error('Modal scrollable element not found');
        }
    }, selector);
};

const getReviews = async (page) => {
    return await page.$$eval(REVIEW_SELECTOR, (nodes, NAME_SELECTOR , COMMENT_SELECTOR , RATE_SELECTOR, DATE_SELECTOR) => nodes.map(node => {
        const name = node.querySelector(NAME_SELECTOR)?.textContent || '';
        const comment = node.querySelector(COMMENT_SELECTOR)?.textContent || '';
        const rateString = node.querySelector(RATE_SELECTOR)?.getAttribute('aria-label') || '';
        const rate = rateString.match(/\d+/) ? rateString.match(/\d+/)[0] : '';
        const date = node.querySelector(DATE_SELECTOR)?.textContent || '';

        return { name, comment, rate, date };
    }), NAME_SELECTOR , COMMENT_SELECTOR , RATE_SELECTOR, DATE_SELECTOR );
};

const addNewReviews = (reviews, newReviews) => {
    newReviews.forEach(newReview => {
        if (!reviews.some(review => review.comment === newReview.comment)) {
            reviews.push(newReview);
        }
    });
    return reviews;
};

const sortReviewsByDate = (reviews) => {
    return reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const delay = (time) => {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

const downloadReviews = (reviews) => {
    const date = moment().format('YYYY-MM-DD-HH-mm-ss');
    const filename = `./uploads/reviews-${date}.json`;

    fs.writeFile(filename, JSON.stringify(reviews, null, 2), (err) => {
        if (err) {
            console.error('Error writing file:', err);
        } else {
            console.log('File written successfully');
        }
    });
};

const scrapeReviews = async (url, numberOfReviews) => {
    let reviews = [];
    const { browser, page } = await initBrowser(url);
    await onClickSelector(page, OPEN_MODAL_BUTTON_SELECTOR);
    await delay(500);
    await onClickSelector(page, OPEN_SORT_SELECT_SELECTOR);
    await delay(500);
    await onClickSelector(page, OPTION_SELECTOR);
    await delay(500);

    let previousReviewCount = 0;
    let sameCount = 0;

    for(let i = 0; i < numberOfReviews; i++) {
        const newReviews = await getReviews(page);
        reviews = addNewReviews(reviews, newReviews);
        console.log(`Current number of reviews: ${reviews.length}`);

        if(reviews.length === previousReviewCount) {
            sameCount++;
            console.log(`No new reviews found, iteration: ${sameCount}`);
            if (sameCount >= 3) {
                console.log('No new reviews found for 3 consecutive checks, breaking...');
                break;
            }
        } else {
            sameCount = 0;
        }

        previousReviewCount = reviews.length;
        await scrollPage(page, MODAL_SCROLLABLE_SELECTOR);
        await delay(500);
        if(reviews.length >= numberOfReviews) {
            break;
        }
    }
    await browser.close();

    const sortedReviews =  sortReviewsByDate(reviews.slice(0, numberOfReviews));
    console.log(`Scrapped number of reviews: ${sortedReviews.length}`);
    downloadReviews(sortedReviews);
};

const url = 'https://play.google.com/store/apps/details?id=com.spotify.music&hl=en&gl=US';

console.time('Scraping Time');

scrapeReviews(url, 10000)
    .then(reviews => {
        console.dir(reviews, { 'maxArrayLength': null });
        console.timeEnd('Scraping Time');
    })
    .catch(error => {
        console.error('Error during scraping:', error);
    });