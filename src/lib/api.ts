const API_URL = '/api';

// --- VERIFICATION STEP ---
// This message MUST appear in your browser's developer console.
// If it doesn't, the browser is using an old, cached version of this file.
console.log("V2 - Using PROXY configuration. API requests will go to: ", API_URL);
// --- END VERIFICATION ---

/**
 * A helper function for making authenticated API calls that expect a JSON response.
 */
export const fetchWithToken = async (endpoint: string, token: string | null, options: RequestInit = {}) => {
    if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
    }
    const headers = { 'Content-Type': 'application/json', 'x-auth-token': token, ...options.headers };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }));
        throw new Error(errorData.message || 'An API error occurred.');
    }
    const responseText = await response.text();
    return responseText ? JSON.parse(responseText) : {};
};

/**
 * A helper function for making authenticated API calls that expect a file/blob response (like a PDF).
 */
export const fetchBlobWithToken = async (endpoint: string, token: string | null, options: RequestInit = {}) => {
    if (!token) { throw new Error("Authentication token not found."); }
    const headers = { 'Content-Type': 'application/json', 'x-auth-token': token, ...options.headers };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }));
        throw new Error(errorData.message || 'An API error occurred.');
    }
    return response.blob();
};