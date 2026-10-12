/*
    Fake News Detection System (Upgraded - 20+ Conditions)

    Rule-based implementation using:
    - Article
    - Source
    - Analyzer
    - KeywordAnalyzer
    - SourceAnalyzer
    - SimilarityAnalyzer
    - AttributionAnalyzer
    - CredibilityReport
    - NewsDatabase
*/

new AICredibilityAnalyzer(AQ.Ab8RN6I_JfxduGhN1IvKS2YCtyAM4Qrf_NDmWgqfuFvQfnkbPw) 

// ==========================================
// LEVENSHTEIN DISTANCE (edit distance)
// ==========================================
function levenshteinDistance(a, b) {

    const rows = a.length + 1;
    const cols = b.length + 1;

    const dp =
        Array.from(
            { length: rows },
            () => new Array(cols).fill(0)
        );

    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;

    for (let i = 1; i < rows; i++) {

        for (let j = 1; j < cols; j++) {

            if (a[i - 1] === b[j - 1]) {

                dp[i][j] = dp[i - 1][j - 1];

            } else {

                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j - 1], // substitution
                    dp[i - 1][j],     // deletion
                    dp[i][j - 1]      // insertion
                );
            }
        }
    }

    return dp[rows - 1][cols - 1];
}


// ==========================================
// SOURCE NAME NORMALIZATION
// ==========================================
function normalizeSourceName(name) {

    return name
        .toLowerCase()
        .trim()
        .replace(/^www\./, "")
        .replace(/\.(com|net|org|ph|co)$/, "")
        .replace(/[^a-z0-9\s]/g, "");
}


const SUPABASE_URL = "https://phcnrnprkndjhztrvauh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_deV_4p8S9sIjtb5tuHy82w_ENfY2y-t";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

// ==========================================
// ARTICLE CLASS
// ==========================================

class Article {

    constructor(
        headline,
        body,
        sourceName,
        date
    ) {

        this.headline = headline.trim();
        this.body = body.trim();
        this.sourceName = sourceName.trim();
        this.date =
            date ||
            new Date().toISOString().slice(0, 10);
    }
}


// ==========================================
// SOURCE CLASS
// ==========================================

class Source {

    constructor(
        name,
        rating,
        weight
    ) {

        this.name = name;
        this.rating = rating;
        this.weight = weight;
    }
}


// ==========================================
// ABSTRACT ANALYZER CLASS
// ==========================================

class Analyzer {

    analyze(article) {

        throw new Error(
            "Analyzer.analyze() must be implemented."
        );
    }
}


// ==========================================
// KEYWORD & TEXT PATTERN ANALYZER (Conditions 1 - 8)
// ==========================================

class KeywordAnalyzer
    extends Analyzer {

    constructor() {

        super();

        this.keywords = new Map([
            ["breaking", 3],
            ["urgent", 4],
            ["exclusive", 3],
            ["viral", 4],
            ["scandal", 4],
            ["shocking", 6],
            ["unbelievable", 6],
            ["secret", 5],
            ["exposed", 6],
            ["destroyed", 6],
            ["slams", 5],
            ["outrage", 5],
            ["bombshell", 6],
            ["insane", 5],
            ["you need to know", 5],
            ["gone wrong", 5],
            ["what happened next", 6],
            ["you won't believe", 9],
            ["miracle", 8],
            ["100% proof", 10],
            ["guaranteed", 7],
            ["must see", 7],
            ["share now", 9],
            ["share this before", 10],
            ["they don't want you to know", 10],
            ["truth they don't want you to know", 10],
            ["mainstream media won't tell you", 10],
            ["doctors hate", 9],
            ["cure they don't want", 10],
            ["wake up", 6],
            ["click here", 8],
            ["won't believe what happens", 10]
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

            if (found) {
                hits.push({ phrase, weight });
            }
        }

        const keywordScore = hits.reduce((sum, hit) => sum + hit.weight, 0);

        const commonAcronyms = new Set([
            "usa", "uk", "un", "eu", "who", "nba", "nfl", "ceo",
            "faq", "fbi", "cia", "gdp", "covid", "ai", "us",
            "bbc", "cnn", "npr", "abc", "nbc", "cbs", "fox", "afp",
            "upi", "pbs", "nyt", "wsj", "ap", "pna", "gma",
            "nasa", "fda", "cdc", "nato", "dna", "gps"
        ]);

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
        const questionCount = (text.match(/\?/g) || []).length;

        // --- UPGRADED CONDITIONS (1 to 8) ---
        let suspicion = 0;
        const reasons = [];

        // Condition 1: High keyword/sensational score match
        if (keywordScore > 0) {
            suspicion += Math.min(40, keywordScore);
            const names = hits.sort((a, b) => b.weight - a.weight).slice(0, 3).map(h => h.phrase);
            reasons.push(`[Condition 1] Detected sensational keywords: ${names.join(", ")}.`);
        }

        // Condition 2: Excessive uppercase / shouting ratio (> 15%)
        if (shoutRatio > 0.15) {
            suspicion += 25;
            reasons.push("[Condition 2] Excessive use of capitalized words ('shouting') detected.");
        } else if (shoutRatio > 0.07) {
            suspicion += 12;
            reasons.push("[Condition 2b] Moderate capital letter density noted.");
        }

        // Condition 3: Excessive punctuation runs (!!! or ???)
        if (punctuationRuns.length > 0) {
            suspicion += Math.min(20, punctuationRuns.length * 6);
            reasons.push("[Condition 3] Multiple punctuation runs (e.g., '!!!') found.");
        }

        // Condition 4: Excessive standalone exclamation marks
        if (exclamationCount >= 3) {
            suspicion += 10;
            reasons.push(`[Condition 4] High frequency of exclamation marks (${exclamationCount}).`);
        }

        // Condition 5: Clickbait headline ending in question mark
        const headlineEndsWithQ = article.headline.trim().endsWith("?");
        if (headlineEndsWithQ) {
            suspicion += 8;
            reasons.push("[Condition 5] Betteridge's law / Headline framed as an unanswered question.");
        }

        // Condition 6: Excessive conversational or direct reader address ("you", "your")
        const directAddressMatches = (text.match(/\b(you|your|yours)\b/gi) || []).length;
        if (directAddressMatches > 6) {
            suspicion += 10;
            reasons.push("[Condition 6] High frequency of direct reader manipulation terms ('you', 'your').");
        }

        // Condition 7: Extreme length deficit (too short to be a valid detailed article)
        if (article.body.length < 100 && article.body.length > 0) {
            suspicion += 15;
            reasons.push("[Condition 7] Extremely short article body length, lacking context.");
        }

        // Condition 8: Excessive numbers/percentages used as bait (e.g. "100%", "10 ways")
        const clickbaitNumberRegex = /\b(100%|top \d+|\d+ ways|reasons why)\b/i;
        if (clickbaitNumberRegex.test(text)) {
            suspicion += 10;
            reasons.push("[Condition 8] Contains listicle-style numerical bait phrasing.");
        }

        suspicion = Math.min(100, Math.round(suspicion));

        if (!reasons.length) {
            reasons.push("No major keyword or text pattern infractions were found.");
        }

        return {
            name: "Keyword & Text Pattern Analyzer",
            suspicion: suspicion,
            credibility: 100 - suspicion,
            reason: reasons.join(" ")
        };
    }
}


// ==========================================
// SOURCE ANALYZER (Conditions 9 - 13)
// ==========================================

class SourceAnalyzer
    extends Analyzer {

    constructor(sourceTable) {
        super();
        this.sourceTable = new Map(
            Object.entries(sourceTable).map(([key, source]) =>
                [normalizeSourceName(key), source]
            )
        );
        this.trustedKeys = [...this.sourceTable.entries()]
            .filter(([, source]) => source.rating === "trusted")
            .map(([key]) => key);
    }


    analyze(article) {
        const rawSource = article.sourceName;
        const key = normalizeSourceName(rawSource);
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

        const source = exactMatch || new Source(rawSource, "unverified", 50);

        let suspicion = 0;
        let isBlacklisted = false;
        const reasons = [];

        // --- UPGRADED CONDITIONS (9 to 13) ---
        
        // Condition 9: Typosquatting / Brand Impersonation check
        if (impersonationTarget) {
            suspicion = 90;
            isBlacklisted = true;
            reasons.push(`[Condition 9] Typosquatting detected: Source name mimics trusted outlet '${impersonationTarget}'.`);
        } 
        // Condition 10: Explicit Blacklist check
        else if (source.rating === "blacklisted") {
            suspicion = 85;
            isBlacklisted = true;
            reasons.push(`[Condition 10] Blacklisted source match: '${rawSource}' is marked untrustworthy.`);
        } 
        // Condition 11: Trusted source whitelist check
        else if (source.rating === "trusted") {
            suspicion = Math.max(0, Math.round(100 - source.weight));
            suspicion = Math.min(suspicion, 20);
            reasons.push(`[Condition 11] Verified trusted source match (${source.weight}/100 trust weight).`);
        } 
        // Condition 12: Generic / Placeholder source name check (e.g. "Anonymous", "Admin")
        else if (/^(anonymous|admin|staff|unknown|news|admin123|test)$/i.test(rawSource)) {
            suspicion = 70;
            reasons.push(`[Condition 12] Anonymous or generic placeholder source name ('${rawSource}').`);
        } 
        // Condition 13: Completely unverified custom source
        else {
            suspicion = 50;
            reasons.push(`[Condition 13] Unverified source: '${rawSource}' is missing from known directories.`);
        }

        return {
            name: "Source Reputation Analyzer",
            suspicion: suspicion,
            credibility: 100 - suspicion,
            isBlacklisted: isBlacklisted,
            reason: reasons.join(" ")
        };
    }
}


// ==========================================
// SIMILARITY ANALYZER (Conditions 14 - 15)
// ==========================================

class SimilarityAnalyzer
    extends Analyzer {

    constructor() {
        super();
        this.stopwords = new Set([
            "this", "that", "with", "from", "have", "will",
            "your", "about", "which", "their", "there", "would",
            "could", "should", "these", "those", "into", "than",
            "then", "them", "when", "what", "were", "been", "being",
            "just", "also", "very", "over", "after", "before",
            "such", "some", "here", "does", "doing", "each"
        ]);
    }


    analyze(article) {
        const tokenize = text => new Set(
            text.toLowerCase()
                .replace(/[^a-z0-9\s]/g, " ")
                .split(/\s+/)
                .filter(word => word.length > 3 && !this.stopwords.has(word))
        );

        const headlineWords = tokenize(article.headline);
        const bodyWords = tokenize(article.body);

        if (!headlineWords.size || !bodyWords.size) {
            return {
                name: "Headline/Body Similarity Analyzer",
                suspicion: 50,
                credibility: 50,
                reason: "Insufficient text content for topical similarity calculation."
            };
        }

        let overlap = 0;
        headlineWords.forEach(word => {
            if (bodyWords.has(word)) overlap++;
        });

        const recall = overlap / headlineWords.size;
        const union = new Set([...headlineWords, ...bodyWords]).size;
        const jaccard = overlap / union;
        const similarity = (recall * 0.7) + (jaccard * 0.3);

        let suspicion = Math.round((1 - similarity) * 100);
        suspicion = Math.max(0, Math.min(100, suspicion));

        const reasons = [];

        // --- UPGRADED CONDITIONS (14 to 15) ---
        // Condition 14: Complete disconnect / Clickbait bait-and-switch headline mismatch
        if (recall < 0.15) {
            suspicion = Math.max(suspicion, 75);
            reasons.push(`[Condition 14] Severe topic mismatch: Headline keywords are almost completely absent from the article body (${Math.round(recall * 100)}% overlap).`);
        } else {
            reasons.push(`[Condition 15] Topical coherence score normal: ${Math.round(similarity * 100)}% keyword overlap between headline and body.`);
        }

        return {
            name: "Headline/Body Similarity Analyzer",
            suspicion: suspicion,
            credibility: 100 - suspicion,
            reason: reasons.join(" ")
        };
    }
}


// ==========================================
// ATTRIBUTION & LANGUAGE ANALYZER (Conditions 16 - 20)
// ==========================================

class AttributionAnalyzer
    extends Analyzer {

    constructor() {
        super();
        this.vaguePhrases = new Map([
            ["sources say", 8],
            ["sources close to", 8],
            ["insiders claim", 9],
            ["insiders reveal", 9],
            ["some people say", 9],
            ["some are saying", 8],
            ["many believe", 7],
            ["it is believed", 7],
            ["reports suggest", 6],
            ["it has been reported", 6],
            ["rumor has it", 9],
            ["rumor has", 9],
            ["no one is talking about", 9],
            ["studies show", 5],
            ["research shows", 5],
            ["allegedly", 4]
        ]);

        this.absolutistWords = [
            "always", "never", "everyone", "no one",
            "completely", "totally", "every single",
            "without exception"
        ];
    }


    analyze(article) {
        const text = `${article.headline} ${article.body}`;
        const lower = text.toLowerCase();

        const vagueHits = [];
        for (const [phrase, weight] of this.vaguePhrases) {
            if (lower.includes(phrase)) {
                vagueHits.push({ phrase, weight });
            }
        }

        const absolutistHits = this.absolutistWords.filter(
            word => new RegExp(`\\b${word}\\b`, "i").test(lower)
        );

        const quoteCount = (text.match(/["“”]/g) || []).length;
        const hasAccordingTo = /according to/i.test(text);
        const namedAttribution = /\b[A-Z][a-z]+ (?:said|stated|told|explained|confirmed|announced)\b/.test(text);

        let suspicion = 0;
        const reasons = [];

        // --- UPGRADED CONDITIONS (16 to 20) ---
        
        // Condition 16: Vague or anonymous attribution trap
        if (vagueHits.length > 0) {
            const sumVagueWeight = vagueHits.reduce((s, h) => s + h.weight, 0);
            suspicion += Math.min(35, sumVagueWeight);
            const names = vagueHits.slice(0, 2).map(h => h.phrase);
            reasons.push(`[Condition 16] Vague sourcing detected: ${names.join(", ")}.`);
        }

        // Condition 17: Extreme absolutist generalization language
        if (absolutistHits.length > 0) {
            suspicion += Math.min(20, absolutistHits.length * 7);
            reasons.push(`[Condition 17] Over-generalized absolute claims (${absolutistHits.slice(0, 2).join(", ")}).`);
        }

        // Condition 18: Lack of verifiable expert names or formal quotes
        if (quoteCount === 0 && !namedAttribution && !hasAccordingTo) {
            suspicion += 15;
            reasons.push("[Condition 18] Zero direct quotations, named attributions, or formal sources found.");
        }

        // Condition 19: Date anomaly check (future dates or extremely stale dates)
        const articleDate = new Date(article.date);
        const currentDate = new Date();
        if (articleDate > currentDate) {
            suspicion += 25;
            reasons.push("[Condition 19] Temporal anomaly: Article date is set in the future.");
        }

        // Condition 20: Positive attribution credit offset
        let attributionCredit = 0;
        if (quoteCount >= 2) attributionCredit += 10;
        if (hasAccordingTo) attributionCredit += 8;
        if (namedAttribution) attributionCredit += 10;

        if (attributionCredit > 0) {
            reasons.push("[Condition 20] Credibility boosted by explicit named attributions and direct quotes.");
        }

        suspicion = Math.max(0, suspicion - attributionCredit);
        suspicion = Math.min(100, Math.round(suspicion));

        if (!reasons.length) {
            reasons.push("No major attribution or linguistic anomalies detected.");
        }

        return {
            name: "Attribution & Language Analyzer",
            suspicion: suspicion,
            credibility: 100 - suspicion,
            reason: reasons.join(" ")
        };
    }
}



// ==========================================
// AI CREDIBILITY ANALYZER (Google Gemini)
// ==========================================


const GEMINI_API_KEY = "AQ.Ab8RN6I_JfxduGhN1IvKS2YCtyAM4Qrf_NDmWgqfuFvQfnkbPw";
const GEMINI_MODEL = "gemini-2.5-flash"; // Or gemini-1.5-flash

class AICredibilityAnalyzer
    extends Analyzer {

    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
    }

    async analyze(article) {
        if (!this.apiKey || this.apiKey === "AQ.Ab8RN6I_JfxduGhN1IvKS2YCtyAM4Qrf_NDmWgqfuFvQfnkbPw") {
            return this.noDataResult(
                "AI credibility check is not configured (no Gemini API key set)."
            );
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

        const prompt =
            `You are a fact-checking assistant. Judge how credible ` +
            `the following news article is, using your own ` +
            `knowledge of real events, common misinformation ` +
            `patterns, and journalistic red flags.\n\n` +
            `Headline: ${article.headline}\n` +
            `Source: ${article.sourceName}\n` +
            `Date: ${article.date}\n` +
            `Article text: ${article.body.slice(0, 4000)}\n\n` +
            `Respond with ONLY a JSON object of the exact shape ` +
            `{"suspicion": <number 0-100>, "reason": <string>}. ` +
            `0 means completely credible, 100 means almost ` +
            `certainly false or fabricated. Keep the reason to one ` +
            `or two sentences.`;

        const requestBody = {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2
            }
        };

        let data;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.error("Gemini API request failed:", response.status);
                return this.noDataResult("AI credibility check failed (network or API error).");
            }

            data = await response.json();
        } catch (error) {
            console.error("Gemini API error:", error.message);
            return this.noDataResult("AI credibility check failed (network or API error).");
        }

        let parsed;
        try {
            const text = data.candidates[0].content.parts[0].text;
            parsed = JSON.parse(text);
        } catch (error) {
            console.error("Gemini response parsing error:", error.message, data);
            return this.noDataResult("AI credibility check returned an unreadable response.");
        }

        const suspicion = Math.min(
            100,
            Math.max(0, Math.round(parsed.suspicion))
        );

        return {
            name: "AI Credibility Analyzer",
            suspicion: suspicion,
            credibility: 100 - suspicion,
            hasMatch: true,
            reason: parsed.reason || "The AI model did not provide a specific reason."
        };
    }

    noDataResult(reason) {
        return {
            name: "AI Credibility Analyzer",
            suspicion: 50,
            credibility: 50,
            hasMatch: false,
            reason: reason
        };
    }
}

// ==========================================
// CREDIBILITY REPORT
// ==========================================

class CredibilityReport {

    constructor(results) {
        this.results = results;

        const baseWeights = {
            "Source Reputation Analyzer": 0.25,
            "Keyword & Text Pattern Analyzer": 0.25,
            "Headline/Body Similarity Analyzer": 0.10,
            "Attribution & Language Analyzer": 0.15,
            "AI Credibility Analyzer": 0.25
        };

        const aiResult = results.find(result => result.name === "AI Credibility Analyzer");
        const aiMatched = aiResult && aiResult.hasMatch;

        let weights = baseWeights;
        if (!aiMatched) {
            const remainingTotal = 1 - baseWeights["AI Credibility Analyzer"];
            weights = {};
            for (const name in baseWeights) {
                weights[name] = name === "AI Credibility Analyzer" ? 0 : baseWeights[name] / remainingTotal;
            }
        }

        this.credibility = Math.round(
            results.reduce(
                (sum, result) => sum + result.credibility * (weights[result.name] || 0),
                0
            )
        );

        const hasDisqualifyingSource = results.some(result => result.isBlacklisted);
        if (hasDisqualifyingSource) {
            this.credibility = Math.min(this.credibility, 25);
        }

        this.suspicion = 100 - this.credibility;

        if (this.credibility >= 70) {
            this.verdict = "Likely Reliable";
        } else if (this.credibility >= 45) {
            this.verdict = "Uncertain";
        } else {
            this.verdict = "Likely Fake";
        }
    }
}


// ==========================================
// NEWS DATABASE & UI BINDINGS
// ==========================================

class NewsDatabase {
    constructor(userId) {
        this.userId = userId;
        this.history = [];
    }

    async load() {
        const { data, error } = await supabaseClient
            .from("history")
            .select("*")
            .eq("user_id", this.userId)
            .order("created_at", { ascending: false });

        if (error) {
            this.history = [];
            return;
        }
        this.history = data;
    }

    async save(article, report) {
        const { data, error } = await supabaseClient
            .from("history")
            .insert({
                user_id: this.userId,
                article: article,
                credibility: report.credibility,
                suspicion: report.suspicion,
                verdict: report.verdict
            })
            .select()
            .single();

        if (error) return;
        this.history.unshift(data);
    }

    async clear() {
        const { error } = await supabaseClient
            .from("history")
            .delete()
            .eq("user_id", this.userId);

        if (error) return;
        this.history = [];
    }

    getMostSuspicious() {
        return [...this.history].sort((a, b) => b.suspicion - a.suspicion);
    }
}

const knownSources = {
    "reuters": new Source("Reuters", "trusted", 95),
    "bbc": new Source("BBC", "trusted", 92),
    "associated press": new Source("Associated Press", "trusted", 93),
    "ap": new Source("Associated Press", "trusted", 93),
    "the new york times": new Source("The New York Times", "trusted", 85),
    "nytimes": new Source("The New York Times", "trusted", 85),
    "npr": new Source("NPR", "trusted", 88),
    "the guardian": new Source("The Guardian", "trusted", 82),
    "philippine daily inquirer": new Source("Philippine Daily Inquirer", "trusted", 85),
    "inquirer": new Source("Philippine Daily Inquirer", "trusted", 85),
    "rappler": new Source("Rappler", "trusted", 82),
    "gma news": new Source("GMA News", "trusted", 80),
    "abscbn news": new Source("ABS-CBN News", "trusted", 80),
    "philstar": new Source("The Philippine Star", "trusted", 78),
    "pna": new Source("Philippine News Agency", "trusted", 80),
    "example-blacklist.com": new Source("example-blacklist.com", "blacklisted", 10),
    "worldnewsdailyreport": new Source("World News Daily Report", "blacklisted", 5),
    "the onion": new Source("The Onion", "blacklisted", 15)
};

let database = null;
const analyzers = [
    new SourceAnalyzer(knownSources),
    new KeywordAnalyzer(),
    new SimilarityAnalyzer(),
    new AttributionAnalyzer(),
    new AICredibilityAnalyzer(GROQ_API_KEY)
];

const $ = id => document.getElementById(id);

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[character]));
}

function verdictClass(verdict) {
    if (verdict === "Likely Reliable") return "good";
    if (verdict === "Uncertain") return "warn";
    return "bad";
}

function renderReport(report) {
    const className = verdictClass(report.verdict);
    $("verdictPill").className = `pill ${className}`;
    $("verdictPill").textContent = report.verdict;
    $("scoreRing").style.setProperty("--score", report.credibility);
    $("scoreValue").textContent = `${report.credibility}%`;
    $("verdictTitle").textContent = report.verdict;

    $("analyzerResults").innerHTML = report.results.map(result => `
        <div class="analyzer">
            <div class="analyzer-top">
                <span class="analyzer-name">${escapeHtml(result.name)}</span>
                <span class="analyzer-score">${result.credibility}% credibility</span>
            </div>
            <div class="progress">
                <div style="width:${result.credibility}%"></div>
            </div>
            <small>${escapeHtml(result.reason)}</small>
        </div>
    `).join("");
}

function renderHistory() {
    const history = database ? database.getMostSuspicious() : [];
    $("historyCount").textContent = `${history.length} check${history.length === 1 ? "" : "s"}`;
    if (!history.length) {
        $("historyList").innerHTML = `<div class="empty-state">No previous checks.</div>`;
        return;
    }
    $("historyList").innerHTML = history.map(item => `
        <div class="history-item">
            <div>
                <p class="history-title">${escapeHtml(item.article.headline)}</p>
                <p class="history-meta">${escapeHtml(item.article.sourceName)} • ${escapeHtml(item.article.date)} • ${escapeHtml(item.verdict)}</p>
            </div>
            <div class="suspicion">${item.suspicion}%<small>suspicion</small></div>
        </div>
    `).join("");
}

$("newsForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!database) return;

    const article = new Article($("headline").value, $("body").value, $("source").value, $("date").value);
    const submitBtn = $("newsForm").querySelector("button[type=submit]");
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Checking...";

    const results = await Promise.all(analyzers.map(analyzer => analyzer.analyze(article)));

    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    const report = new CredibilityReport(results);
    renderReport(report);
    await database.save(article, report);
    renderHistory();
});

$("resetBtn").addEventListener("click", () => {
    $("newsForm").reset();
    $("scoreRing").style.setProperty("--score", 0);
    $("scoreValue").textContent = "--";
    $("verdictPill").className = "pill neutral";
    $("verdictPill").textContent = "Not analyzed";
    $("verdictTitle").textContent = "Ready to analyze";
    $("analyzerResults").innerHTML = `<div class="empty-state">No analyzer results yet.</div>`;
});

$("clearAllBtn").addEventListener("click", async () => {
    if (!database || !database.history.length) return;
    if (confirm("Clear all saved analysis history?")) {
        await database.clear();
        renderHistory();
    }
});

let authMode = "login";
function setAuthMode(mode) {
    authMode = mode;
    document.querySelectorAll(".auth-tab").forEach(tab =>
        tab.classList.toggle("active", tab.dataset.mode === mode)
    );
    $("authSubmitBtn").textContent = mode === "login" ? "Log In" : "Create Account";
    $("authError").hidden = true;
    $("authNotice").hidden = true;
}

document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => setAuthMode(tab.dataset.mode));
});

$("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    $("authError").hidden = true;
    $("authNotice").hidden = true;

    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    if (authMode === "login") {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            $("authError").hidden = false;
            $("authError").textContent = error.message;
        }
    } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            $("authError").hidden = false;
            $("authError").textContent = error.message;
            return;
        }
        if (!data.session) {
            $("authNotice").hidden = false;
            $("authNotice").textContent = "Account created! Check your email to confirm it, then log in.";
            setAuthMode("login");
        }
    }
});

$("signOutBtn").addEventListener("click", () => {
    supabaseClient.auth.signOut();
});

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
        $("authScreen").hidden = true;
        $("appShell").hidden = false;
        $("userEmail").textContent = session.user.email;
        database = new NewsDatabase(session.user.id);
        await database.load();
        renderHistory();
    } else {
        database = null;
        $("appShell").hidden = false ? true : true; // Keep auth gate open
        $("appShell").hidden = true;
        $("authScreen").hidden = false;
        $("authForm").reset();
        setAuthMode("login");
    }
});
