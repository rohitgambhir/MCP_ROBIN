import axios from 'axios';

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

export async function getLLMGenerations(prompt) {
    try {
        const response = await axios({
            method: 'get',
            url: 'https://google.com',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'authorization': 'Bearer',
                'content-type': 'application/json',
            }
        });
        
        // Decode the response text if it's URL encoded and contains HTML entities
        if (response.data?.generations?.[0]?.text) {            
            // First decode URL encoding
            let decodedText = decodeURIComponent(response.data.generations[0].text);
            // Then decode HTML entities
            decodedText = decodedText
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"');
            response.data.generations[0].text = decodedText;
        }
        return response.data;
    } catch (error) {
        console.error('Error making API request:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        throw error;
    }
}