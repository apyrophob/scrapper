import puppeteer, { Page } from "puppeteer";

export type RawReview = {
    id: string;
    userName: string;
    userImage: string;
    date: string;
    score: number;
    url?: null | string;
    title?: null | string;
    text: string;
    version?: string;
    thumbsUp: number;
};

const SELECTORS = {
    OPEN_MODAL_BUTTON: 'button[class*="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d LQeN7 aLey0c"]',
    OPEN_SORT_SELECT: "#sortBy_1",
    OPTION: 'div[data-filter-id="sortBy_2"]',
    MODAL_SCROLLABLE: ".fysCi",
    REVIEW_ID: ".c1bOId",
    REVIEW: ".RHo1pe",
    NAME: ".X5PpBb",
    ICON: ".T75of.abYEib",
    COMMENT: ".h3YV2d",
    THUMBS_UP: ".AJTPZc",
    RATE: ".iXRFPc",
    DATE: ".bp9Aid",
};

const initBrowser = async (url: string) => {
    const browser = await puppeteer.launch({
        headless: true,
        protocolTimeout: 400000,
        args: ["--no-sandbox", "--disabled-setupid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });
    return { browser, page };
};

const onClickSelector = async (page: Page, selector: string) => {
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
    await page.click(selector);
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
};

const scrollPage = async (page: Page, selector: string) => {
    await page.evaluate((selector) => {
        const modalScrollable = document.querySelector(selector);
        modalScrollable.scrollTop = modalScrollable.scrollHeight;
    }, selector);
};

const delay = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

const getReviews = async (page: Page, startIndex: number, max: number): Promise<RawReview[]> => {
    const reviews = [];
    for (let i = startIndex; i < max; i++) {
        const r = await page.evaluate((index) => {
            const reviewNode = document.querySelectorAll(SELECTORS.REVIEW)[index];

            if (!reviewNode) {
                return null;
            }

            const reviewId = reviewNode.querySelector(SELECTORS.REVIEW_ID).getAttribute("data-review-id");
            const userName = reviewNode.querySelector(SELECTORS.NAME)?.textContent || "";
            const userImage = reviewNode.querySelector(SELECTORS.ICON).getAttribute("src");
            const reviewText = reviewNode.querySelector(SELECTORS.COMMENT)?.textContent || "";
            const scoreString = reviewNode.querySelector(SELECTORS.RATE).getAttribute("aria-label");
            const score = parseInt(scoreString.match(/\d+/) ? scoreString.match(/\d+/)[0] : "0");
            const thumbsUpString = reviewNode.querySelector(SELECTORS.THUMBS_UP)?.textContent || "";
            const thumbsUp = parseInt(thumbsUpString.match(/\d+/) ? thumbsUpString.match(/\d+/)[0] : "0");
            const dateString = reviewNode.querySelector(SELECTORS.DATE)?.textContent || "";
            const date = new Date(dateString).toISOString();

            return JSON.stringify({ id: reviewId, userName, userImage, text: reviewText, score, date, thumbsUp });
        }, i);

        if (!r) {
            break;
        }

        reviews.push(JSON.parse(r));
    }

    return reviews;
};

export async function* scrapeReviews(gplayAppId: string, max: number) {
    const url = `https://play.google.com/store/apps/details?id=${gplayAppId}&hl=en&gl=US`;
    const { browser, page } = await initBrowser(url);

    await onClickSelector(page, SELECTORS.OPEN_MODAL_BUTTON);
    await delay(500);
    await onClickSelector(page, SELECTORS.OPEN_SORT_SELECT);
    await delay(500);
    await onClickSelector(page, SELECTORS.OPTION);
    await delay(500);

    let totalReviewsCount = 0;
    let emptyReviewsRetries = 0;

    while (totalReviewsCount < max) {
        const newReviews = await getReviews(page, totalReviewsCount, totalReviewsCount + 20);

        if (newReviews.length === 0) {
            emptyReviewsRetries += 1;
            if (emptyReviewsRetries > 200) {
                break;
            }
        } else {
            emptyReviewsRetries = 0;
            yield newReviews;
        }

        totalReviewsCount += newReviews.length;

        await scrollPage(page, SELECTORS.MODAL_SCROLLABLE);
        await delay(200);
    }

    await browser.close();
    return [];
}