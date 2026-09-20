/* ==========================================
   SUPABASE & GEMINI CONFIGURATION
   ========================================== */

// 1. Supabase Credentials
const SUPABASE_URL = "https://phcnrnprkndjhztrvauh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dev_4p8S9sIjtb5tuHy82w_ENfY2..."; // Replace with your full publishable key from Supabase

// Initialize Supabase Client
let supabaseClient = null;
if (typeof supabase !== "undefined") {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 2. Retrieve Gemini API Key from Local Storage
function getGeminiApiKey() {
    return localStorage.getItem("GEMINI_API_KEY");
}

/* ==========================================
   AUTHENTICATION HANDLERS
   ========================================== */

async function handleLogin(email, password) {
    const errorElement = document.getElementById("error-message");
    if (errorElement) errorElement.innerText = "";

    if (!supabaseClient) {
        if (errorElement) errorElement.innerText = "Supabase client not initialized.";
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        if (errorElement) errorElement.innerText = error.message;
        console.error("Login Error:", error.message);
        return;
    }

    console.log("Logged in successfully:", data);
    alert("Login successful!");
    // You can show the analyzer UI or redirect here
}

async function handleSignUp(email, password) {
    const errorElement = document.getElementById("error-message");
    if (errorElement) errorElement.innerText = "";

    if (!supabaseClient) {
        if (errorElement) errorElement.innerText = "Supabase client not initialized.";
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        if (errorElement) errorElement.innerText = error.message;
        console.error("Sign Up Error:", error.message);
        return;
    }

    alert("Sign up successful! Please check your email for confirmation.");
}

/* ==========================================
   GEMINI AI ANALYSIS HANDLER
   ========================================== */

async function analyzeArticleWithGemini(title, content) {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
        alert("Gemini API key missing! Please set it in DevTools console.");
        return;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Analyze the following news article for credibility, bias, and potential fake news indicators:
    
Headline: ${title}
Content: ${content}`;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: promptText }]
                    }
                ]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini API Error:", data.error.message);
            alert(`AI Analysis Error: ${data.error.message}`);
            return;
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        console.log("Gemini Analysis:", aiResponseText);
        
        // Display result in UI element if present
        const resultElement = document.getElementById("ai-result");
        if (resultElement) {
            resultElement.innerText = aiResponseText;
        }

    } catch (err) {
        console.error("Fetch Error:", err);
        alert("Failed to connect to Gemini API.");
    }
}

/* ==========================================
   FORM EVENT LISTENERS
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");

    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            handleLogin(email, password);
        });
    }
});
