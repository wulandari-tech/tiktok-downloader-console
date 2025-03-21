const fs = require("fs");
const axios = require("axios").default;
const {
    wrapper
} = require("axios-cookiejar-support");
const {
    CookieJar,
    formatDate
} = require("tough-cookie");
const cheerio = require("cheerio");
const http = require('http'); // Import modul http

// User-agent string used for making HTTP requests
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const REGEX = /^https?:\/\/(www\.|vm\.)?(tiktok\.com)\/?(.*)$/;

// Creating a CookieJar instance to handle cookies across requests
const cookieJar = new CookieJar();

// Creating an Axios instance with cookie jar support
const instance = wrapper(
    axios.create({
        withCredentials: true,
        jar: cookieJar,
    })
);

// Headers to be used in HTTP requests
const headers = {
    "User-Agent": "TikTok 26.2.0 rv:262018 (iPhone; iOS 14.4.2; en_US) Cronet",
};
/**
 * Fetches HTML content from the specified URL using Axios.
 *
 * @param {string} url - The URL to fetch HTML content from.
 * @returns {Promise<string>} - A Promise resolving to the HTML content.
 * @throws {Error} - Throws an error if the request fails.
 */
const handleHtml = async (url) => {
    try {
        // Make an HTTP request to fetch HTML content
        let res = await instance(url, {
            headers: {
                "User-Agent": USER_AGENT,
            },
        });
        const {
            data
        } = res;
        return data;
    } catch (e) {
        // Throw an error if the request fails
        throw new Error(e);
    }
};

/**
 * Loads HTML content into Cheerio for easier manipulation and traversal.
 *
 * @param {string} html - The HTML content to load into Cheerio.
 * @returns {CheerioStatic} - A Cheerio instance representing the loaded HTML.
 * @throws {Error} - Throws an error if loading the HTML into Cheerio fails.
 */
const getDocument = (html) => {
    try {
        // Load HTML content into Cheerio
        const loadedHtml = cheerio.load(html);
        return loadedHtml;
    } catch (e) {
        // Throw an error if loading into Cheerio fails
        throw new Error(e);
    }
};

/**
 * Downloads images from the specified URLs and saves them to the filesystem.
 *
 * @param {string} url - The base URL for referring purposes.
 * @param {string} imageId - The unique identifier for the image.
 * @param {string[]} imageUrlPath - Array of image URLs to download.
 * @param {string} tanggalan - The date information associated with the images.
 * @param {string} authorUniqueId - The unique identifier of the author.
 * @throws {Error} - Throws an error if downloading images fails.
 */
const downloadImages = async (
    url,
    imageId,
    imageUrlPath,
    tanggalan,
    authorUniqueId
) => {
    try {
        // Set headers for image download request
        const headers = {
            Referer: url,
            "User-Agent": USER_AGENT,
        };

        // Iterate through each image URL
        for (let i = 0; i < imageUrlPath.length; i++) {
            const imageUrl = imageUrlPath[i];
            // Make an HTTP request to download the image
            const response = await instance(imageUrl, {
                headers,
                responseType: "arraybuffer",
            });

            const {
                data
            } = response;

            // Format date for creating a unique filename
            const formattedDate = formatUploadDate(tanggalan);
            const newFileName = `${authorUniqueId}_image_${formattedDate}_${imageId}.jpg`;

            // Specify the relative directory where images will be saved
            const relativeDirectory = "./tiktok-images/";

            // Create the directory if it doesn't exist
            if (!fs.existsSync(relativeDirectory)) {
                fs.mkdirSync(relativeDirectory);
            }

            // Save the image to the filesystem in the specified directory
            fs.writeFileSync(`${relativeDirectory}${newFileName}`, data);
        }
    } catch (error) {
        // Log an error message if downloading images fails
        console.error("Error while downloading images", url, error);
    }
};
/**
 * Extracts the video ID from the given TikTok video URL.
 *
 * @param {string} url - The TikTok video URL.
 * @returns {string|null} - The extracted video ID or null if not found.
 */
const getIdVideo = async (url) => {
    // Use a regular expression to extract the video ID from the URL
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
};
/**
 * Extracts the numeric photo ID from a TikTok photo URL.
 * @param {string} url - The TikTok photo URL.
 * @returns {string|null} - The extracted photo ID if found, or null if not found.
 */
const getIDPhoto = (url) => {
    // Use a regular expression to match and extract the numeric photo ID from the URL
    const match = url.match(/\/photo\/(\d+)/);
    // Return the extracted photo ID or null if not found
    return match ? match[1] : null;
};

/**
 * Formats a timestamp into a string representing the upload date.
 *
 * @param {number} timestamp - The timestamp to format.
 * @returns {string} - The formatted date string (DDMMYYYY).
 */
const formatUploadDate = (timestamp) => {
    const createdDate = new Date(timestamp * 1000);
    const formattedDate = `${createdDate.getDate().toString().padStart(2, "0")}${(
    createdDate.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}${createdDate.getFullYear()}`;
    return formattedDate;
};

/**
 * Generates a unique filename for a TikTok video based on video data.
 *
 * @param {Object} videoData - The TikTok video data.
 * @returns {string} - The generated filename.
 */
const generateVideoFileName = (videoData) => {
    const authorUniqueId = videoData.aweme_list[0].author.unique_id;
    const uploadDate = formatUploadDate(videoData.aweme_list[0].create_time);
    const videoId = videoData.aweme_list[0].aweme_id;

    return `${authorUniqueId}_video_${uploadDate}_${videoId}.mp4`;
};

/**
 * Downloads TikTok videos from the provided URL.
 *
 * @param {string} url - The TikTok video URL.
 * @returns {Promise} - A Promise representing the downloaded video.
 * @throws {Error} - Throws an error if the download process fails.
 */
const download = async (url) => {
    try {
        // Get the video URL information
        const videoUrl = await getInfo(url);

        // Pause execution for 2000 milliseconds (2 seconds)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (!videoUrl) {
            // Resolve the video URL if not already available
            const resolvedVideoUrl = await resolveVideoUrl(url);

            if (!resolvedVideoUrl) {
                throw new Error("Couldn't resolve stream. No video URL found.");
            }

            // Download the video and get the video buffer
            const videoBuffer = await downloadVideo(resolvedVideoUrl, url);

            // Generate the video filename
            const fileName = generateVideoFileName(resolvedVideoUrl);

            const targetFolder = "./tiktok-videos";

            // Check if the target folder exists, create it if not
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, {
                    recursive: true
                });
            }

            // Save the video to the filesystem in the "tiktok-videos" folder
            fs.writeFileSync(`${targetFolder}/${fileName}`, videoBuffer);

            console.log(
                `✅ Video downloaded for ${resolvedVideoUrl.authorUniqueId}_${resolvedVideoUrl.videoId}`
            );

            return resolvedVideoUrl;
        }

        // Configure headers for video download request
        const config = {
            headers: {
                Referer: url,
                "User-Agent": USER_AGENT,
            },
            responseType: "arraybuffer",
        };

        // Make an HTTP request to download the video
        const videoResponse = await instance(videoUrl, config);
        return videoResponse;
    } catch (error) {
        // Log an error message if the download process fails
        console.error("Error while processing", url, error);
        throw error;
    }
};
/**
 * Retrieves TikTok video information from the provided URL.
 *
 * @param {string} url - The TikTok video URL.
 * @returns {Promise<Object>} - A Promise representing the video information.
 * @throws {Error} - Throws an error if retrieving video information fails.
 */
const getInfo = async (url) => {
    try {
        // Validate the URL
        if (!validateURL(url)) {
            throw new Error("Invalid URL provided");
        }

        // Fetch HTML content from the TikTok video URL
        const html = await handleHtml(url);

        // Throw an error if HTML content retrieval fails
        if (!html) {
            throw new Error("Failed to retrieve HTML content from the provided URL");
        }

        let loadedHtml;

        // Retry loop with timeout
        let retryCount = 5; // Number of retries
        while (retryCount > 0) {
            try {
                // Parse HTML content using Cheerio
                loadedHtml = await getDocument(html); // Use await here

                // If parsing is successful, exit the loop
                if (loadedHtml) {
                    break;
                }
            } catch (error) {
                console.error(`Error while parsing HTML: ${error.message}`);
            }

            retryCount--; // Decrement retry count
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait before trying again
        }

        // Throw an error if HTML parsing fails after retries
        if (!loadedHtml) {
            throw new Error("Failed to parse HTML content");
        }

        // Find the script tag containing JSON data
        const jsonDataElement = loadedHtml("#__UNIVERSAL_DATA_FOR_REHYDRATION__");

        // Throw an error if JSON data is not found
        if (!jsonDataElement || jsonDataElement.length === 0) {
            throw new Error("Unable to find JSON data in HTML document");
        }

        // Extract JSON data from the script tag
        const rawJSON = jsonDataElement[0]?.children[0].data;

        // Throw an error if extracting JSON data fails
        if (!rawJSON) {
            throw new Error("Failed to extract JSON data from HTML");
        }

        // Parse the JSON data to get video information
        const data = parseVideoData(rawJSON);

        // Throw an error if parsing video information fails
        if (!data) {
            throw new Error("Failed to extract video information from JSON data");
        }

        return data;
    } catch (error) {
        // Log an error message if getInfo fails
        console.error("Error in getInfo:", error.message);
        throw new Error("Failed to retrieve video information");
    }
};

/**
 * Resolves the TikTok video URL using the provided URL.
 *
 * @param {string} url - The TikTok video URL.
 * @returns {Promise<Object>} - A Promise representing the resolved video URL and additional information.
 * @throws {Error} - Throws an error if resolving video URL fails.
 */
const resolveVideoUrl = async (url) => {
    try {
        // Get the video ID from the TikTok video URL
        const idVideo = await getIdVideo(url);

        // Throw an error if video ID is not found
        if (!idVideo) {
            throw new Error("Couldn't resolve stream. Video ID not found.");
        }

        // Construct the API URL for fetching video data
        const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${idVideo}`;

        try {
            // Make an API request to fetch video data
            const apiResponse = await instance(API_URL, {
                method: "GET",
                headers: headers,
            });

            // Get the video data from the API response
            const videoData = apiResponse.data;

            // Check if the video data contains the necessary information
            if (
                videoData?.aweme_list?.[0]?.video &&
                videoData.aweme_list[0].video.play_addr &&
                videoData.aweme_list[0].video.play_addr.url_list &&
                videoData.aweme_list[0].video.play_addr.url_list[0]
            ) {
                // Return the resolved video URL and additional information
                return {
                    resolvedVideoUrl: videoData.aweme_list[0].video.play_addr.url_list[0],
                    authorUniqueId: videoData.aweme_list[0].author.unique_id,
                    videoId: videoData.aweme_list[0].aweme_id,
                };
            } else {
                throw new Error("Couldn't resolve stream. No video URL found.");
            }
        } catch (error) {
            // Handle errors during API request
            console.error("Error in API request:", error.message);
            throw error;
        }
    } catch (error) {
        // Log an error message if resolveVideoUrl fails
        console.error("Error in resolveVideoUrl:", error.message);
        throw error;
    }
};
/**
 * Downloads TikTok video from the resolved video URL.
 *
 * @param {string} resolvedVideoUrl - The resolved video URL.
 * @param {string} url - The original TikTok video URL.
 * @returns {Promise<Buffer>} - A Promise representing the downloaded video buffer.
 * @throws {Error} - Throws an error if downloading video fails.
 */
const downloadVideo = async (resolvedVideoUrl, url) => {
    try {
        // Make an HTTP request to download the video
        const videoResponse = await instance(resolvedVideoUrl, {
            headers: {
                Referer: url,
                "User-Agent": USER_AGENT,
            },
            responseType: "arraybuffer",
        });

        // Return the video buffer
        return videoResponse.data;
    } catch (error) {
        // Log an error message if downloading video fails
        console.error("Error while downloading video:", error.message);
        throw error;
    }
};

/**
 * Validates whether the provided string is a valid TikTok video URL.
 *
 * @param {string} url - The URL to validate.
 * @returns {boolean} - True if the URL is valid, false otherwise.
 */
const validateURL = (url) => {
    // Check if the URL matches the TikTok video URL regex
    if (!url || typeof url !== "string") return false;
    return REGEX.test(url);
};

/**
 * Parses raw JSON data to extract video information.
 *
 * @param {string} raw - The raw JSON data to parse.
 * @returns {Promise<string>} - A Promise representing the resolved video URL.
 * @throws {Error} - Throws an error if parsing JSON data fails.
 */
const parseVideoData = async (raw) => {
    if (!raw) {
        // Throw an error if no raw JSON data is provided
        throw new Error("No raw JSON data provided");
    }

    try {
        // Pause execution for 2000 milliseconds (2 seconds)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Parse the raw JSON data
        const data = JSON.parse(raw);

        // Extract the resolved video URL from the JSON data
        const playAddrUrlList =
            data?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct
            ?.video?.bitrateInfo?.[0]?.PlayAddr?.UrlList;

        // Check if the JSON structure is valid and contains sufficient data
        if (!playAddrUrlList || playAddrUrlList.length < 2) {
            throw new Error(
                "Invalid JSON structure. PlayAddr.UrlList not found or insufficient data."
            );
        }

        // Return the resolved video URL
        return playAddrUrlList[1];
    } catch (e) {
        // Log an error message if parsing JSON data fails
        console.error("Error parsing JSON data:", e.message);
        throw new Error("Failed to parse JSON data");
    }
};



// Membuat server HTTP
const server = http.createServer(async (req, res) => {
    // Mengatur header CORS agar dapat diakses dari berbagai origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

     // Menangani preflight request (OPTIONS)
     if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }


    // Handle request dengan method GET dan URL '/'
    if (req.method === 'GET' && req.url === '/') {
        // Array of TikTok video URLs
        const urls = [
            "https://www.tiktok.com/@user1/video/1234567890123456789",
            "https://www.tiktok.com/@user2/video/2345678901234567890",
            "https://www.tiktok.com/@user3/photo/3456789012345678901",
            "https://www.tiktok.com/@user4/photo/4567890123456789012",
        ];
        // Additional query parameters for TikTok URL
        const queryParams =
            "?is_from_webapp=1&sender_device=pc&web_id=7221493350775866882";

        // Array untuk menyimpan hasil download
        const downloadResults = [];

        // Loop through each TikTok URL
        for (const url of urls) {
            let modifiedUrl = url;
            // Append query parameters to the URL
            if (url.includes("?")) {
                modifiedUrl += "&" + queryParams;
            } else {
                modifiedUrl += "?" + queryParams;
            }

            try {
                // Check if the URL is for a photo or video
                if (url.includes("/photo/")) {
                    // If the URL is for a photo, download the image
                    const idVideo = await getIDPhoto(url);
                    const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${idVideo}`;
                    const request = await instance(API_URL, {
                        method: "GET",
                        headers: headers,
                    });
                    const body = request.data;

                    // Check if the photo has images
                    if (
                        body.aweme_list[0].image_post_info &&
                        body.aweme_list[0].image_post_info.images &&
                        body.aweme_list[0].image_post_info.images.length > 0
                    ) {
                        const imageList = body.aweme_list[0].image_post_info.images;

                        // Loop through each image
                        for (let i = 0; i < imageList.length; i++) {
                            const authorUniqueId = body.aweme_list[0].author.unique_id;
                            const imageUrl = imageList[i].display_image.url_list[0];
                            const awemeId = body.aweme_list[0].aweme_id;
                            const tanggalan = body.aweme_list[0].create_time;
                            const imageIndex = i + 1;
                            const imageId = `${awemeId}_${imageIndex}`;
                            const formattedDate = formatUploadDate(tanggalan);

                            const newFileName = `${authorUniqueId}_image_${formattedDate}_${imageIndex}.jpg`;

                            // Download the image
                            await downloadImages(
                                url,
                                imageId,
                                [imageUrl],
                                tanggalan,
                                authorUniqueId,
                                newFileName
                            );
                            console.log(
                                `✅ Image ${imageIndex} downloaded for ${authorUniqueId}`
                            );

                            // Tambahkan hasil download ke array
                            downloadResults.push({
                                type: 'image',
                                url: imageUrl,
                                filename: newFileName
                            });
                        }
                    } else {
                        console.log("No images found for the provided photo URL.");
                    }
                } else {
                    // If the URL is for a video, download the video
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    const resp = await download(modifiedUrl);
                    const {
                        data
                    } = resp;

                    // Video download logic
                    const $ = getDocument(await handleHtml(url));
                    const jsonDataElement = $("#__UNIVERSAL_DATA_FOR_REHYDRATION__");
                    await new Promise((resolve) => setTimeout(resolve, 3000));

                    // Check if JSON data is present in the HTML document
                    if (jsonDataElement && jsonDataElement.length > 0) {
                        const rawJSON = jsonDataElement[0]?.children?.[0]?.data;

                        // Check if raw JSON data is present
                        if (rawJSON) {
                            try {
                                // Parse JSON data
                                const parsedJSON = JSON.parse(rawJSON);
                                const videoDetail =
                                    parsedJSON?.__DEFAULT_SCOPE__?.["webapp.video-detail"];

                                // Check if videoDetail is present in parsed JSON
                                if (videoDetail) {
                                    const itemInfo = videoDetail?.itemInfo;
                                    const itemStruct = itemInfo?.itemStruct;
                                    const author = itemStruct?.author;

                                    // Check if author information is present
                                    if (author) {
                                        const authorName = author?.uniqueId ?? "UnknownAuthor";
                                        const formattedDate = formatUploadDate(itemStruct.createTime);
                                        const newFileName = `${authorName}_video_${formattedDate}_${itemStruct.id}.mp4`;

                                        // Check if video data is defined and write to file
                                        if (data !== undefined) {
                                            const targetFolder = "./tiktok-videos";

                                            // Check if the target folder exists, create it if not
                                            if (!fs.existsSync(targetFolder)) {
                                                fs.mkdirSync(targetFolder, {
                                                    recursive: true
                                                });
                                            }

                                            // Save the video to the filesystem in the "tiktok-videos" folder
                                            fs.writeFileSync(`${targetFolder}/${newFileName}`, data);
                                            console.log(
                                                `✅ Video downloaded for ${authorName}_${itemStruct.id}`
                                            );

                                            // Tambahkan hasil download ke array
                                            downloadResults.push({
                                                type: 'video',
                                                url: modifiedUrl,
                                                filename: newFileName
                                            });
                                        } else {
                                            console.error("Error: Video data is undefined.");
                                        }
                                    } else {
                                        console.error("Error: 'author' is undefined.");
                                    }
                                } else {
                                    console.error("Error: 'videoDetail' is undefined.");
                                }
                            } catch (error) {
                                console.error("Failed to parse JSON:", error.message);
                            }
                        } else {
                            console.error("Failed to extract JSON data from HTML");
                        }
                    } else {
                        // console.error("Unable to find JSON data in HTML document");
                    }
                }
            } catch (error) {
                console.error("Error while processing", url, error);
            }
        }

        // Mengirimkan response dengan hasil download
        res.writeHead(200, {
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(downloadResults));
    } else {
        // Mengirimkan response 'Not Found' jika URL tidak cocok
        res.writeHead(404, {
            'Content-Type': 'text/plain'
        });
        res.end('Not Found');
    }
});

// Menjalankan server pada localhost dan port 8080
const PORT = 8080;
server.listen(PORT, 'localhost', () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
