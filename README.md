# Web Scraping & Crawling Service

This project provides a web scraping and crawling service to extract product URLs from a list of specified domains. It uses **Express** to serve a RESTful API, **Axios** to fetch HTML content, **Cheerio** to parse HTML, and **Puppeteer Cluster** to manage concurrent crawling tasks in a headless browser.

## Features

- Crawl multiple domains concurrently using Puppeteer Cluster.
- Extract and normalize product URLs from each domain.
- Save the results as a JSON file containing a list of product URLs for each domain.
- Simple RESTful API to trigger the crawling process.

## Technologies

- **Node.js** - JavaScript runtime.
- **Express** - Web framework to build the server and expose the API.
- **Axios** - Promise-based HTTP client for fetching HTML content.
- **Cheerio** - Library to parse and manipulate HTML.
- **Puppeteer Cluster** - Tool for managing headless browsers and handling concurrency in web scraping.

## Setup

### Prerequisites

- Ensure that **Node.js** is installed on your machine. You can download it from [here](https://nodejs.org/).

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/web-scraping-crawler.git
   cd web-scraping-crawler



npm install
npm start

{
  "domains": ["example.com", "anotherdomain.com"]
}

{
  "example.com": [
    "https://example.com/product/123",
    "https://example.com/product/456"
  ],
  "anotherdomain.com": [
    "https://anotherdomain.com/product/789"
  ]
}
