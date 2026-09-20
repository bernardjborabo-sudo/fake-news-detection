/* ==========================================
   SUPABASE & CONFIGURATION SETUP
   ========================================== */

const SUPABASE_URL = "https://phcnrnprkndjhztrvauh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_deV_4p8S9sIjtb5tuHy82w_ENfY2y-t"; // Ensure your full publishable key is here

let supabaseClient = null;
let currentAuthMode = "login"; // 'login' or 'signup'

// Initialize Supabase Client safely
if (typeof supabase !== "undefined") {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getGeminiApiKey() {
    return localStorage.getItem("GEMINI_API_KEY");
}

/* ==========================================
   UI TAB SWITCHING
   ========================================== */

function switchTab(mode) {
    currentAuthMode = mode;
    const loginTab = document.getElementById("tab-login");
    const signupTab = document.getElementById("tab-signup");
    const authBtn = document.getElementById("auth-btn");
    const errorEl = document.getElementById("auth-error");
    const successEl = document.getElementById("auth-success");

    errorEl.innerText = "";
    successEl.innerText = "";

    if (mode === "login") {
        loginTab.classList.add("active");
        signupTab.classList.remove("active");
        authBtn.innerText = "Log In";
    } else {
        signupTab.classList.add("active");
        loginTab.classList.remove("active");
        authBtn.innerText = "Sign Up";
    }
}

/* ==========================================
   AUTHENTICATION LOGIC
   ========================================== */

async function handleAuth(email, password) {
    const errorEl = document.getElementById("auth-error");
    const successEl = document.getElementById("auth-success");
    errorEl.innerText = "";
    successEl.innerText = "";

    if (!supabaseClient) {
        errorEl.innerText = "Supabase SDK failed to initialize.";
        return;
    }

    if (currentAuthMode === "login") {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            errorEl.innerText = error.message;
        } else {
            showDashboard();
        }
    } else {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) {
            errorEl.innerText = error.message;
        } else {
            successEl.innerText = "Sign-up successful! Please log in.";
            switchTab("login");
        }
    }
}

async function handleLogout() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    document.getElementById("auth-container").classList.remove("hidden");
    document.getElementById("app-container").classList.add("hidden");
}

function showDashboard() {
    document.getElementById("auth-container").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
}

/* ==========================================
   GEMINI AI ANALYSIS INTEGRATION
   ========================================== */

async function analyzeArticle(title, content) {
    const apiKey = getGeminiApiKey();
    const resultBox = document.getElementById("result-box");
    const resultEl = document.getElementById("ai-result");

    if (!apiKey) {
        alert("Missing Gemini API Key! Please set it in DevTools console via localStorage.");
        return;
    }

    resultBox.classList.remove("hidden");
    resultEl.innerText = "Analyzing article with Gemini AI...";

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const promptText = `Perform a fact-check and credibility assessment on this text:\n\nTitle: ${title}\nContent: ${content}`;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        const data = await response.json();

        if (data.error) {
            resultEl.innerText = "Error: " + data.error.message;
        } else {
            const aiText = data.candidates[0].content.parts[0].text;
            resultEl.innerText = aiText;
        }
    } catch (err) {
        resultEl.innerText = "Failed to connect to the AI analysis service.";
    }
}

function loadSampleData() {
    document.getElementById("article-title").value = "Breaking: Scientists Discover Water on Mars surface";
    document.getElementById("article-content").value = "Researchers have announced a significant geological finding confirming liquid water traces on Mars through satellite analysis...";
}

/* ==========================================
   INITIALIZATION & EVENT LISTENERS
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {
    const authForm = document.getElementById("auth-form");
    const analysisForm = document.getElementById("analysis-form");

    if (authForm) {
        authForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            handleAuth(email, password);
        });
    }

    if (analysisForm) {
        analysisForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const title = document.getElementById("article-title").value;
            const content = document.getElementById("article-content").value;
            analyzeArticle(title, content);
        });
    }
});
