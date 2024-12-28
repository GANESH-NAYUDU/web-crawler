// Required modules
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { Cluster } = require('puppeteer-cluster');

// Utility function to validate and normalize URLs
const normalizeUrl = (base, relative) => {
    try {
        const fullUrl = new URL(relative, base).toString();
        return fullUrl;
    } catch (error) {
        console.error(`Error normalizing URL: base=${base}, relative=${relative}`);
        return null; // Skip invalid URLs
    }
};

// Identify product URLs based on patterns
const isProductUrl = (url) => {
    const patterns = [/\/product\//i, /\/item\//i, /\/p\//i, /\/dp\/[A-Z0-9]+/i, /\/gp\/product\/[A-Z0-9]+/i];     
     return patterns.some((pattern) => pattern.test(url));
};
// Fetch HTML content using Axios
const fetchHtml = async (url) => {
    if (typeof url !== 'string' || !url.startsWith('http')) {
        console.error(`Invalid URL passed to fetchHtml: ${JSON.stringify(url)}`); // Log the problematic URL
        return null;
    }

    try {
        const { data } = await axios.get(url);
        return data;
    } catch (err) {
        console.error(`Error fetching ${url}:`, err.message);
        return null;
    }
};

// Extract URLs from the page
const extractUrls = (html, baseUrl) => {
    const $ = cheerio.load(html);
    const links = new Set();

    $('a').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
            try {
                const fullUrl = normalizeUrl(baseUrl, href.split('#')[0].split('?')[0]);
                links.add(fullUrl);
            } catch {
                console.error(`Invalid URL ignored: ${href}`);
            }
        }
    });

    return Array.from(links); // Return as an array
};


// Main function
const crawlWebsites = async (domains) => {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_PAGE,
        maxConcurrency: 5,
        puppeteerOptions: { headless: true },
    });

    const results = {}; // Store results for all domains

    // Task function to process each URL
    await cluster.task(async ({ page, data: url }) => {
        console.log(`Visiting URL: ${url}`);
        try {
            // Visit the page and get content
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const html = await page.content();

            // Extract URLs from the page
            const urls = extractUrls(html, url);
            console.log(`Extracted URLs from ${url}:`, urls);

            for (const link of urls) {
                // If it's a product URL, add it to the results
                if (isProductUrl(link)) {
                    console.log(`Found product URL: ${link}`);
                    results[url] = results[url] || new Set(); // Initialize if undefined
                    results[url].add(link); // Add product URL
                }
            }
        } catch (error) {
            console.error(`Error visiting ${url}:`, error.message);
        }
    });

    // Initialize results for each domain and start crawling
    for (const domain of domains) {
        console.log(`Crawling ${domain}...`);
        await cluster.queue(domain); // Start with the initial domain
    }

    await cluster.idle(); // Wait for all tasks to finish
    await cluster.close(); // Close the cluster

    // Convert Sets to Arrays for saving
    for (const key in results) {
        results[key] = Array.from(results[key]);
    }

    // Save results to file
    const fs = require('fs');
    fs.writeFileSync('./productUrls.json', JSON.stringify(results, null, 2));
    console.log('Results saved to ./productUrls.json');

    return results;
};


// Express server setup
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


app.get("/", async (req, res) => {
    res.send("HELLO,THIS IS A WEB CRAWLER APPLICATION")
}
)

const validateDomains = (domains) => {
    return domains.map((domain) => {
        try {
            const url = new URL(domain); // Ensures valid domain
            return url.toString();
        } catch (error) {
            console.error(`Invalid domain: ${domain}`);
            return null;
        }
    }).filter(Boolean); // Removes invalid domains
};

app.post('/crawl', async (req, res) => {
    const { domains } = req.body;

    if (!domains || !Array.isArray(domains)) {
        return res.status(400).json({ error: 'Please provide a valid list of domains.' });
    }

    const validatedDomains = validateDomains(domains);
    if (validatedDomains.length === 0) {
        return res.status(400).json({ error: 'No valid domains provided.' });
    }
    console.log(domains)
    try {
        const results = await crawlWebsites(domains);
        res.json(results);
    } catch (err) {
        console.error('Error during crawling:', err.message);
        res.status(500).json({ error: 'An error occurred during crawling.' });
    }
});

