require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3000;

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

app.use(express.json());
app.use(cors()); // Enable CORS for all routes
app.use(express.static(__dirname)); // Serve static files from the project root

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/track-ranks', async (req, res) => {
    const { businessName, keyword, gridPoints } = req.body;

    console.log(`Received request to track ranks for keyword: "${keyword}" for business: "${businessName || 'N/A'}"`);
    console.log(`Number of grid points: ${gridPoints.length}`);

    const rankingResults = [];

    for (const point of gridPoints) {
        await sleep(1000); // Wait for 1 second before the next API call

        const { lat, lng } = point;
        const gl = `us`; // Google country (e.g., 'us', 'uk')
        const hl = `en`; // Google UI language (e.g., 'en', 'es')
        const location = `${lat},${lng}`; // Latitude and longitude for the search

        const serpApiUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(keyword)}&ll=@${location},15z&type=search&api_key=${SERPAPI_API_KEY}&gl=${gl}&hl=${hl}`;

        try {
            console.log(`Fetching SerpApi for: ${serpApiUrl}`);
            const response = await axios.get(serpApiUrl);
            const data = response.data;

            // console.log(`SerpApi Response for (${lat},${lng}):`, JSON.stringify(data, null, 2));

            let rank = -1; // Default to -1 if not found
            let status = 'Not Found';

            if (data['local_results']) {
                // Iterate through local results to find the business
                for (let i = 0; i < data.local_results.length; i++) {
                    const result = data.local_results[i];
                    const targetBusiness = businessName || keyword;
                    // Simple case-insensitive match by business name or keyword
                    if (result.title && result.title.toLowerCase().includes(targetBusiness.toLowerCase())) {
                        rank = i + 1; // Rank is 1-based
                        status = `Rank: ${rank}`;
                        console.log(`Business "${targetBusiness}" found at rank ${rank} for (${lat},${lng})`);
                        break;
                    }
                }
            } else if (data.error) {
                console.error(`SerpApi Error for (${lat},${lng}):`, data.error);
                status = 'API Error';
            }

            rankingResults.push({
                ...point,
                rank: rank,
                status: status,
            });

        } catch (error) {
            console.error(`Error fetching data for point (${lat},${lng}):`, error.message);
            rankingResults.push({
                ...point,
                rank: -2, // Indicate a general error
                status: 'Fetch Error',
            });
        }
    }

    res.json({ success: true, results: rankingResults });
});

app.get('/', (req, res) => {
    res.send('Local Grid Rank Tracker Backend');
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
