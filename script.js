/* ==========================================
   CONFIG & UTILITIES
   ========================================== */

// Updated with your Supabase Project URL and Anon Key:
const SUPABASE_URL = "https://aoxxlyasawlkyllakewt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveHhseWFzYXdsa3lsbGFrZXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzNzc4MzMsImV4cCI6MjA1Njk1MzgzM30.6i-6T2iL2dYpQp0SInX8K-eG0q_L0jQ9s2-b91c_P6g";

// Initialize Supabase Client
let supabaseClient = null;

function getSupabase() {
    if (!supabaseClient && typeof supabase !== "undefined") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

// Levenshtein Distance for edit distance / typosquatting check
function levenshteinDistance(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp[rows - 1][cols - 1];
}

// Normalize domain names for lookup
function normalizeSourceName(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/^www\./, "")
        .replace(/\.(com|net|org|ph|co|gov|edu)$/, "")
        .replace(/[^a-z0-9\s]/g, "");
}


/* ==========================================
   CLASSES & DOMAIN MODELS
   ========================================== */

class Article {
    constructor(headline, body, sourceName, date) {
        this.headline = (headline || "").trim();
        this.body = (body || "").trim();
        this.sourceName = (sourceName || "").trim();
        this.date = date || new Date().toISOString().slice(0, 10);
    }
}

class Source {
    constructor(name, rating, weight) {
        this.name = name;
        this.rating = rating;
        this.weight = weight;
    }
}

class Analyzer {
    analyze(article) {
        throw new Error("Analyzer.analyze() must be implemented.");
    }
}


/* ==========================================
   ANALYZER IMPLEMENTATIONS
   ========================================== */

// 1. Keyword & Text Pattern Analyzer
class KeywordAnalyzer extends Analyzer {
    constructor() {
        super();
        this.keywords = new Map([
            ["breaking", 3], ["urgent", 4], ["exclusive", 3], ["viral", 4], ["scandal", 4],
            ["shocking", 6], ["unbelievable", 6], ["secret", 5], ["exposed", 6],
            ["destroyed", 6], ["slams", 5], ["outrage", 5], ["bombshell", 6], ["insane", 5],
            ["you need to know", 5], ["gone wrong", 5], ["what happened next", 6],
            ["you won't believe", 9], ["miracle", 8], ["100% proof", 10], ["guaranteed", 7],
            ["must see", 7], ["share now", 9], ["share this before", 10],
            ["they don't want you to know", 10], ["doctors hate", 9], ["click here", 8]
        ]);
    }

    analyze(article) {
        const text = `${article.headline} ${article.body}`;
        const lower = text.toLowerCase();
        const hits = [];

        for (const [phrase, weight] of this.keywords) {
            const hasSpace = phrase.includes(" ");
            const found = hasSpace
                ? lower.includes(phrase)
                : new RegExp(`\\b${phrase}\\b`, "i").test(lower);
            if (found) hits.push({ phrase, weight });
        }

        const keywordScore = hits.reduce((sum, hit) => sum + hit.weight, 0);
        const commonAcronyms = new Set(["usa", "uk", "un", "eu", "who", "nba", "ceo", "fbi", "cia", "covid", "ai", "bbc", "cnn", "nyt", "wsj", "ap", "nasa", "fda"]);

        const words = text.match(/[A-Za-z']+/g) || [];
        const shoutWords = words.filter(word =>
            word.length >= 3 &&
            word === word.toUpperCase() &&
            /[A-Z]/.test(word) &&
            !commonAcronyms.has(word.toLowerCase())
        );

        const shoutRatio = words.length ? shoutWords.length / words.length : 0;
        const punctuationRuns = text.match(/[!?]{2,}|\.{3,}/g) || [];
        const exclamationCount = (text.match(/!/g) || []).length;

        let suspicion = Math.min(45, keywordScore);

        if (shoutRatio > 0.15) suspicion += 25;
        else if (shoutRatio > 0.07) suspicion += 12;

        let punctuationScore = Math.min(20, punctuationRuns.length * 6);
        if (exclamationCount >= 5) punctuationScore += 10;
        else if (exclamationCount >= 2) punctuationScore += 5;

        suspicion = Math.min(100, Math.round(suspicion + Math.min(30, punctuationScore)));

        const reasons = [];
        if (hits.length) reasons.push(`Sensational/clickbait terms found: ${hits.slice(0, 3).map(h => h.phrase).join(", ")}.`);
        if (shoutRatio > 0.07) reasons.push("Elevated all-caps text detected.");
        if (punctuationRuns.length || exclamationCount >= 2) reasons.push("Excessive punctuation detected.");
        if (!reasons.length) reasons.push("No obvious clickbait or excessive punctuation patterns detected.");

        return {
            name: "Keyword & Text Pattern Analyzer",
            suspicion,
            credibility: 100 - suspicion,
            reason: reasons.join(" ")
        };
    }
}

// 2. Source Reputation Analyzer
class SourceAnalyzer extends Analyzer {
    constructor(sourceTable = {}) {
        super();
        this.sourceTable = new Map(
            Object.entries(sourceTable).map(([key, source]) => [normalizeSourceName(key), source])
        );
        this.trustedKeys = [...this.sourceTable.entries()]
            .filter(([, source]) => source.rating === "trusted")
            .map(([key]) => key);
    }

    analyze(article) {
        const key = normalizeSourceName(article.sourceName);
        const exactMatch = this.sourceTable.get(key);
        let impersonationTarget = null;

        if (!exactMatch && key.length >= 4) {
            let bestDistance = Infinity;
            let bestKey = null;

            for (const trustedKey of this.trustedKeys) {
                const distance = levenshteinDistance(key, trustedKey);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestKey = trustedKey;
                }
            }

            if (bestKey && bestDistance > 0 && bestDistance <= 2) {
                impersonationTarget = this.sourceTable.get(bestKey).name;
            }
        }

        const source = exactMatch || new Source(article.sourceName, "unverified", 50);
        let suspicion;

        if (impersonationTarget) {
            suspicion = 88;
        } else {
            suspicion = Math.round(100 - source.weight);
            if (source.rating === "blacklisted") suspicion = Math.max(suspicion, 80);
            else if (source.rating === "trusted") suspicion = Math.min(suspicion, 20);
            else suspicion = Math.min(Math.max(suspicion, 35), 65);
        }

        let reason;
        if (impersonationTarget) reason = `Source closely matches trusted outlet "${impersonationTarget}" (possible impersonation).`;
        else if (source.rating === "trusted") reason = `Source "${article.sourceName}" is recognized as trusted.`;
        else if (source.rating === "blacklisted") reason = `Source "${article.sourceName}" is flagged on blacklists.`;
        else reason = `Source "${article.sourceName}" is not in standard database (unverified).`;

        return {
            name: "Source Reputation Analyzer",
            suspicion,
            credibility: 100 - suspicion,
            reason
        };
    }
}

// 3. Headline/Body Similarity Analyzer
class SimilarityAnalyzer extends Analyzer {
    constructor() {
        super();
        this.stopwords = new Set(["this", "that", "with", "from", "have", "will", "your", "about", "which", "their", "there", "would", "could", "should", "these", "those", "into", "than", "then", "them", "when", "what"]);
    }

    analyze(article) {
        const tokenize = text => new Set(
            text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !this.stopwords.has(w))
        );

        const headlineWords = tokenize(article.headline);
        const bodyWords = tokenize(article.body);

        if (!headlineWords.size || !bodyWords.size) {
            return { name: "Headline/Body Similarity Analyzer", suspicion: 50, credibility: 50, reason: "Insufficient text for comparison." };
        }

        let overlap = 0;
        headlineWords.forEach(w => { if (bodyWords.has(w)) overlap++; });

        const recall = overlap / headlineWords.size;
        const jaccard = overlap / new Set([...headlineWords, ...bodyWords]).size;
        const similarity = (recall * 0.7) + (jaccard * 0.3);
        const suspicion = Math.max(0, Math.min(100, Math.round((1 - similarity) * 100)));

        return {
            name: "Headline/Body Similarity Analyzer",
            suspicion,
            credibility: 100 - suspicion,
            reason: `Topical alignment between headline and body is ${Math.round(similarity * 100)}%.`
        };
    }
}

// 4. Attribution & Language Analyzer
class AttributionAnalyzer extends Analyzer {
    constructor() {
        super();
        this.vaguePhrases = ["sources say", "sources close to", "insiders claim", "some people say", "many believe", "rumor has it", "allegedly"];
    }

    analyze(article) {
        const lower = `${article.headline} ${article.body}`.toLowerCase();
        const foundPhrases = this.vaguePhrases.filter(p => lower.includes(p));

        let suspicion = Math.min(40, foundPhrases.length * 12);
        if (/according to/i.test(lower) || /["“”]/.test(article.body)) suspicion = Math.max(0, suspicion - 15);

        return {
            name: "Attribution & Language Analyzer",
            suspicion,
            credibility: 100 - suspicion,
            reason: foundPhrases.length ? `Vague sourcing detected: "${foundPhrases.join('", "')}".` : "Clear statements and citations detected."
        };
    }
}

// 5. AI Assistant Analyzer (Gemini Flash Integration)
class AIAssistantAnalyzer extends Analyzer {
    constructor(apiKey = null) {
        super();
        this.apiKey = apiKey || localStorage.getItem("GEMINI_API_KEY");
    }

    async analyze(article) {
        if (!this.apiKey) {
            return { name: "AI Fact Check Assistant", suspicion: 50, credibility: 50, hasMatch: false, reason: "No Gemini API key provided. Add GEMINI_API_KEY to localStorage to enable." };
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Evaluate this claim directly:\nHeadline: "${article.headline}"\nSource: "${article.sourceName}"\nBody: "${article.body.slice(0, 1000)}"\n\nReturn strict JSON format with keys:\n{\n  "directAnswer": "<1-2 sentence evaluation>",\n  "credibilityScore": <number 0-100>,\n  "verdict": "<True | False | Misleading | Unverified>"\n}`
                        }]
                    }]
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            
            // Clean markdown blocks or extra text around JSON response
            const cleanedText = rawText.replace(/```json|```/gi, "").trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

            const credibility = Math.min(100, Math.max(0, parsed.credibilityScore ?? 50));
            return {
                name: "AI Fact Check Assistant",
                suspicion: 100 - credibility,
                credibility,
                hasMatch: true,
                verdict: parsed.verdict || "Unverified",
                reason: `[${parsed.verdict || 'Unverified'}] ${parsed.directAnswer || 'Analysis complete.'}`
            };
        } catch (err) {
            console.warn("AI Assistant fallback:", err);
            return { name: "AI Fact Check Assistant", suspicion: 50, credibility: 50, hasMatch: false, reason: "AI service unavailable or request failed." };
        }
    }
}

// Credibility Report Compiler
class CredibilityReport {
    constructor(results) {
        this.results = results;
    }

    calculateOverallScore() {
        if (!this.results.length) return 50;
        let weightedSum = 0;
        let totalWeight = 0;

        for (const res of this.results) {
            let weight = 1;
            if (res.name.includes("Source Reputation")) weight = 2.5;
            if (res.name.includes("AI Fact Check") && res.hasMatch) weight = 3.5;

            weightedSum += (res.credibility * weight);
            totalWeight += weight;
        }

        return Math.round(weightedSum / totalWeight);
    }

    getVerdict(score) {
        if (score >= 75) return { title: "Likely Credible", badgeClass: "success" };
        if (score >= 45) return { title: "Uncertain / Unverified", badgeClass: "warning" };
        return { title: "Potentially Fake / Misleading", badgeClass: "danger" };
    }
}


/* ==========================================
   APP CONTROLLER & UI BINDINGS
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Supabase client
    getSupabase();

    // UI Element References
    const authScreen = document.getElementById("authScreen");
    const appShell = document.getElementById("appShell");
    const authForm = document.getElementById("authForm");
    const authEmail = document.getElementById("authEmail");
    const authPassword = document.getElementById("authPassword");
    const authError = document.getElementById("authError");
    const authNotice = document.getElementById("authNotice");
    const authSubmitBtn = document.getElementById("authSubmitBtn");
    const authTabs = document.querySelectorAll(".auth-tab");

    const userEmailSpan = document.getElementById("userEmail");
    const signOutBtn = document.getElementById("signOutBtn");
    const clearAllBtn = document.getElementById("clearAllBtn");

    const newsForm = document.getElementById("newsForm");
    const headlineInput = document.getElementById("headline");
    const sourceInput = document.getElementById("source");
    const dateInput = document.getElementById("date");
    const bodyInput = document.getElementById("body");
    const resetBtn = document.getElementById("resetBtn");
    const sampleBtn = document.getElementById("sampleBtn");

    const scoreRing = document.getElementById("scoreRing");
    const scoreValue = document.getElementById("scoreValue");
    const verdictPill = document.getElementById("verdictPill");
    const verdictTitle = document.getElementById("verdictTitle");
    const verdictText = document.getElementById("verdictText");
    const analyzerResults = document.getElementById("analyzerResults");

    const historyList = document.getElementById("historyList");
    const historyCount = document.getElementById("historyCount");

    let authMode = "login"; // 'login' or 'signup'
    let currentUser = null;

    // Default known sources table
    const knownSources = {
        "reuters": new Source("Reuters", "trusted", 95),
        "associated press": new Source("Associated Press", "trusted", 95),
        "bbc": new Source("BBC News", "trusted", 90),
        "the onion": new Source("The Onion", "blacklisted", 10),
        "world news daily report": new Source("World News Daily Report", "blacklisted", 5)
    };

    /* --- AUTHENTICATION LOGIC --- */

    authTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            authTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            authMode = tab.dataset.mode;
            authSubmitBtn.textContent = authMode === "login" ? "Log In" : "Sign Up";
            authError.hidden = true;
            authNotice.hidden = true;
        });
    });

    // Check active user session
    if (supabaseClient) {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session) handleSession(session.user);
        });

        supabaseClient.auth.onAuthStateChange((_event, session) => {
            if (session) handleSession(session.user);
            else handleSignOut();
        });
    }

    function handleSession(user) {
        currentUser = user;
        if (userEmailSpan) userEmailSpan.textContent = user.email;
        if (authScreen) authScreen.style.display = "none";
        if (appShell) appShell.hidden = false;
        loadHistory();
    }

    function handleSignOut() {
        currentUser = null;
        if (appShell) appShell.hidden = true;
        if (authScreen) authScreen.style.display = "flex";
    }

    authForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        authError.hidden = true;
        authNotice.hidden = true;

        if (!supabaseClient) {
            authError.textContent = "Supabase configuration missing. Check SUPABASE_URL and SUPABASE_ANON_KEY.";
            authError.hidden = false;
            return;
        }

        const email = authEmail.value.trim();
        const password = authPassword.value;

        authSubmitBtn.disabled = true;

        if (authMode === "login") {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                authError.textContent = error.message;
                authError.hidden = false;
            }
        } else {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            if (error) {
                authError.textContent = error.message;
                authError.hidden = false;
            } else {
                authNotice.textContent = "Sign up successful! Please check your email to confirm registration.";
                authNotice.hidden = false;
            }
        }

        authSubmitBtn.disabled = false;
    });

    signOutBtn?.addEventListener("click", async () => {
        if (supabaseClient) await supabaseClient.auth.signOut();
    });

    /* --- FORM & SAMPLE ACTIONS --- */

    sampleBtn?.addEventListener("click", () => {
        headlineInput.value = "SHOCKING PROOF: Secret Miracle Cure Hidden By Mainstream Media!";
        sourceInput.value = "ReaI Reuters News";
        dateInput.value = new Date().toISOString().slice(0, 10);
        bodyInput.value = "You won't believe what happens next! Insiders claim that doctors hate this one weird trick. Share this before it gets taken down! Sources close to the investigation reveal that this secret discovery has been completely destroyed by elites.";
    });

    resetBtn?.addEventListener("click", () => {
        newsForm.reset();
        scoreValue.textContent = "--";
        verdictTitle.textContent = "Ready to analyze";
        verdictText.textContent = "Enter a headline, source, and article text, then click Analyze Credibility.";
        verdictPill.className = "pill neutral";
        verdictPill.textContent = "Not analyzed";
        analyzerResults.innerHTML = `<div class="empty-state">No analyzer results yet.</div>`;
    });

    /* --- ANALYSIS & REPORTING --- */

    newsForm?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const article = new Article(
            headlineInput.value,
            bodyInput.value,
            sourceInput.value,
            dateInput.value
        );

        // Run Sync Analyzers
        const keywordRes = new KeywordAnalyzer().analyze(article);
        const sourceRes = new SourceAnalyzer(knownSources).analyze(article);
        const simRes = new SimilarityAnalyzer().analyze(article);
        const attrRes = new AttributionAnalyzer().analyze(article);

        // Run Async AI Analyzer
        const aiRes = await new AIAssistantAnalyzer().analyze(article);

        const results = [sourceRes, keywordRes, simRes, attrRes, aiRes];
        const report = new CredibilityReport(results);
        const overallScore = report.calculateOverallScore();
        const verdict = report.getVerdict(overallScore);

        // Display Score & Verdict
        scoreValue.textContent = `${overallScore}%`;
        verdictTitle.textContent = verdict.title;
        verdictPill.textContent = verdict.title;
        verdictPill.className = `pill ${verdict.badgeClass}`;
        verdictText.textContent = `Overall credibility rating computed across ${results.length} heuristic and AI diagnostic modules.`;

        // Render Individual Analyzer Cards
        analyzerResults.innerHTML = results.map(res => `
            <div class="analyzer-item">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong>${res.name}</strong>
                    <span class="pill ${res.credibility >= 70 ? 'success' : res.credibility >= 40 ? 'warning' : 'danger'}">
                        ${res.credibility}% Credible
                    </span>
                </div>
                <p style="font-size: 0.88rem; color: #555; margin: 0;">${res.reason}</p>
            </div>
        `).join("");

        // Save check to database
        await saveCheckToHistory(article, overallScore, 100 - overallScore);
    });

    /* --- HISTORY & DATABASE INTEGRATION --- */

    async function saveCheckToHistory(article, credibilityScore, suspicionScore) {
        if (!supabaseClient || !currentUser) return;

        const record = {
            user_id: currentUser.id,
            headline: article.headline,
            source: article.sourceName,
            article_date: article.date,
            credibility_score: credibilityScore,
            suspicion_score: suspicionScore,
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient.from("article_checks").insert([record]);
        if (error) console.error("Database save failed:", error.message);
        loadHistory();
    }

    async function loadHistory() {
        if (!supabaseClient || !currentUser) return;

        const { data, error } = await supabaseClient
            .from("article_checks")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("suspicion_score", { ascending: false });

        if (error) {
            console.error("Failed to load history:", error.message);
            return;
        }

        if (historyCount) historyCount.textContent = `${data ? data.length : 0} checks`;

        if (!data || data.length === 0) {
            if (historyList) historyList.innerHTML = `<div class="empty-state">No previous checks recorded.</div>`;
            return;
        }

        if (historyList) {
            historyList.innerHTML = data.map(item => `
                <div class="history-item" style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="display: block; font-size: 0.95rem;">${item.headline}</strong>
                        <span style="font-size: 0.8rem; color: #666;">Source: ${item.source} | Date: ${item.article_date || 'N/A'}</span>
                    </div>
                    <div style="text-align: right;">
                        <span class="pill ${item.credibility_score >= 70 ? 'success' : item.credibility_score >= 40 ? 'warning' : 'danger'}">
                            ${item.credibility_score}% Score
                        </span>
                    </div>
                </div>
            `).join("");
        }
    }

    clearAllBtn?.addEventListener("click", async () => {
        if (!supabaseClient || !currentUser) return;
        if (!confirm("Are you sure you want to clear your entire check history?")) return;

        const { error } = await supabaseClient
            .from("article_checks")
            .delete()
            .eq("user_id", currentUser.id);

        if (error) {
            alert("Could not clear history: " + error.message);
        } else {
            loadHistory();
        }
    });
});
