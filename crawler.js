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
    const patterns = [/\/product\//i, /\/item\//i, /\/p\//i];
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
        puppeteerOptions: {
            headless: false, // Run in visible mode for debugging
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
    });

    const results = {}; // Store product URLs for each domain
    const visited = new Set(); // Track visited URLs to avoid loops

    // Define the task function for the cluster
    await cluster.task(async ({ page, data: url }) => {
        if (visited.has(url)) return; // Skip already visited URLs
        visited.add(url); // Mark as visited

        console.log(`Visiting URL: ${url}`);
        try {
            // Set user agent for bot detection evasion
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

            // Add random delay to mimic human behavior
            const delay = Math.random() * 3000 + 2000; // 2-5 seconds delay
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Visit the page
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const html = await page.content();

            // Extract URLs
            const urls = extractUrls(html, url);
            console.log(`Extracted URLs from ${url}:`, urls);

            for (const link of urls) {
                if (isProductUrl(link)) {
                    console.log(`Found product URL: ${link}`);
                    results[url] = results[url] || new Set();
                    results[url].add(link); // Add product URL
                } else if (link.startsWith(url)) {
                    console.log(`Queuing URL: ${link}`);
                    await cluster.queue(link); // Queue nested URLs
                }
            }
        } catch (err) {
            console.error(`Error visiting ${url}:`, err.message);
        }
    });

    // Start crawling for each domain
    for (const domain of domains) {
        console.log(`Crawling ${domain}...`);
        await cluster.queue(domain); // Add the domain to the cluster queue
    }

    await cluster.idle(); // Wait for all tasks to finish
    await cluster.close(); // Close the cluster

    // Convert Sets to Arrays for final results
    for (const key in results) {
        results[key] = Array.from(results[key]);
    }

    // Save results to a JSON file
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

