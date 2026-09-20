/*
    Fake News Detection System

    Rule-based and AI-assisted implementation using:
    - Article
    - Source
    - Analyzer
    - KeywordAnalyzer
    - SourceAnalyzer
    - SimilarityAnalyzer
    - AttributionAnalyzer
    - FactCheckAnalyzer (AI-powered)
    - CredibilityReport
*/

// ==========================================
// LEVENSHTEIN DISTANCE (edit distance)
// ==========================================
function levenshteinDistance(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;

    const dp = Array.from(
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

// ==========================================
// ARTICLE CLASS
// ==========================================
class Article {
    constructor(headline, body, sourceName, date) {
        this.headline = (headline || "").trim();
        this.body = (body || "").trim();
        this.sourceName = (sourceName || "").trim();
        this.date = date || new Date().toISOString().slice(0, 10);
    }
}

// ==========================================
// SOURCE CLASS
// ==========================================
class Source {
    constructor(name, rating, weight) {
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
        throw new Error("Analyzer.analyze() must be implemented.");
    }
}

// ==========================================
// KEYWORD ANALYZER
// ==========================================
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
            ["they don't want you to know", 10], ["truth they don't want you to know", 10],
            ["mainstream media won't tell you", 10], ["doctors hate", 9], ["cure they don't want", 10],
            ["wake up", 6], ["click here", 8], ["won't believe what happens", 10]
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

        const commonAcronyms = new Set([
            "usa", "uk", "un", "eu", "who", "nba", "nfl", "ceo", "faq", "fbi", "cia", "gdp", "covid", "ai", "us",
            "bbc", "cnn", "npr", "abc", "nbc", "cbs", "fox", "afp", "upi", "pbs", "nyt", "wsj", "ap", "pna", "gma",
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

        let suspicion = 0;
        suspicion += Math.min(45, keywordScore);

        if (shoutRatio > 0.15) suspicion += 25;
        else if (shoutRatio > 0.07) suspicion += 12;

        let punctuationScore = Math.min(20, punctuationRuns.length * 6);
        if (exclamationCount >= 5) punctuationScore += 10;
        else if (exclamationCount >= 2) punctuationScore += 5;

        suspicion += Math.min(30, punctuationScore);
        suspicion = Math.min(100, Math.round(suspicion));

        const reasons = [];
        if (hits.length) {
            const names = hits.sort((a, b) => b.weight - a.weight).slice(0, 4).map(h => h.phrase);
            reasons.push(`Found ${hits.length} sensational/clickbait pattern(s): ${names.join(", ")}${hits.length > 4 ? "..." : ""}.`);
        }
        if (shoutRatio > 0.15) reasons.push("Excessive capitalized words detected.");
        else if (shoutRatio > 0.07) reasons.push("Higher-than-usual number of capitalized words detected.");
        if (punctuationRuns.length) reasons.push('Excessive punctuation runs (e.g. "!!!") detected.');
        if (exclamationCount >= 2) reasons.push(`${exclamationCount} exclamation marks found in the text.`);
        if (!reasons.length) reasons.push("No major clickbait, capitalization, or punctuation pattern was detected.");

        return {
            name: "Keyword & Text Pattern Analyzer",
            suspicion: suspicion,
            credibility: 100 - suspicion,
            reason: reasons.join(" ")
        };
    }
}

// ==========================================
// SOURCE ANALYZER
// ==========================================
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
        let isBlacklisted = false;

        if (impersonationTarget) {
            suspicion = 88;
            isBlacklisted = true;
        } else {
            suspicion = Math.round(100 - source.weight);
            if (source.rating === "blacklisted") {
                suspicion = Math.max(suspicion, 80);
                isBlacklisted = true;
            } else if (source.rating === "trusted") {
                suspicion = Math.min(suspicion, 20);
            } else {
                suspicion = Math.min(Math.max(suspicion, 35), 65);
            }
        }

        let reason;
        if (impersonationTarget) {
            reason = `Source "${article.sourceName}" closely resembles trusted outlet "${impersonationTarget}" — possible typosquatting/impersonation.`;
        } else if (source.rating === "trusted") {
            reason = `Source "${article.sourceName}" is on the trusted-source list (trust weight ${source.weight}/100).`;
        } else if (source.rating === "blacklisted") {
            reason = `Source "${article.sourceName}" is on the blacklisted-source list.`;
        } else {
            reason = `Source "${article.sourceName}" is not in the known-source table, so it is treated as unverified.`;
        }

        return {
            name: "Source Reputation Analyzer",
            suspicion: suspicion,
            credibility: 100 - suspicion,
            isBlacklisted: isBlacklisted,
            reason: reason
        };
    }
}

// ==========================================
// SIMILARITY ANALYZER
// ==========================================
class SimilarityAnalyzer extends Analyzer {
    constructor() {
        super();
        this.stopwords = new Set([
            "this", "that", "with", "from", "have", "will", "your", "about", "which", "their", "there",
            "would", "could", "should", "these", "those", "into", "than", "then", "them", "when", "what",
            "were", "been", "being", "just", "also", "very", "over", "after", "before", "such", "some", "here"
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
                reason: "Not enough text provided for similarity check."
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

        let suspicion = Math.max(0, Math.min(100, Math.round((1 - similarity) * 100)));

        return {
            name: "Headline/Body Similarity Analyzer",
            suspicion: suspicion,
            credibility: 100 - suspicion,
            reason: `Approximately ${Math.round(recall * 100)}% of headline words appear in body text (topical overlap score: ${Math.round(similarity * 100)}%).`
        };
    }
}

// ==========================================
// ATTRIBUTION & LANGUAGE ANALYZER
// ==========================================
class AttributionAnalyzer extends Analyzer {
    constructor() {
        super();
        this.vaguePhrases = new Map([
            ["sources say", 8], ["sources close to", 8], ["insiders claim", 9], ["insiders reveal", 9],
            ["some people say", 9], ["some are saying", 8], ["many believe", 7], ["it is believed", 7],
            ["reports suggest", 6], ["it has been reported", 6], ["rumor has it", 9], ["no one is talking about", 9],
            ["studies show", 5], ["research shows", 5], ["allegedly", 4]
        ]);

        this.absolutistWords = ["always", "never", "everyone", "no one", "completely", "totally", "every single", "without exception"];
    }

    analyze(article) {
        const text = `${article.headline} ${article.body}`;
        const lower = text.toLowerCase();

        const vagueHits = [];
        for (const [phrase, weight] of this.vaguePhrases) {
            if (lower.includes(phrase)) vagueHits.push({ phrase, weight });
        }

        const absolutistHits = this.absolutistWords.filter(word =>
            new RegExp(`\\b${word}\\b`, "i").test(lower)
        );

        const quoteCount = (text.match(/["“”]/g) || []).length;
        const hasAccordingTo = /according to/i.test(text);
        const namedAttribution = /\b[A-Z][a-z]+ (?:said|stated|told|explained|confirmed|announced)\b/.test(text);

        let suspicion = 0;
        suspicion += Math.min(35, vagueHits.reduce((sum, hit) => sum + hit.weight, 0));
        suspicion += Math.min(20, absolutistHits.length * 7);

        let attributionCredit = 0;
        if (quoteCount >= 2) attributionCredit += 10;
        if (hasAccordingTo) attributionCredit += 8;
        if (namedAttribution) attributionCredit += 10;

        suspicion = Math.max(0, Math.min(100, Math.round(suspicion - attributionCredit)));

        const reasons = [];
        if (vagueHits.length) {
            const names = vagueHits.sort((a, b) => b.weight - a.weight).slice(0, 3).map(h => h.phrase);
            reasons.push(`Found ${vagueHits.length} vague-sourcing phrase(s): ${names.join(", ")}${vagueHits.length > 3 ? "..." : ""}.`);
        }
        if (absolutistHits.length) {
            reasons.push(`Absolutist language detected (${absolutistHits.slice(0, 3).join(", ")}).`);
        }
        if (attributionCredit > 0) {
            reasons.push("Direct quotes or clear named attribution found, supporting credibility.");
        }
        if (!reasons.length) {
            reasons.push("No notable vague-sourcing or absolutist language patterns were detected.");
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
// AI-POWERED FACT CHECK ANALYZER
// ==========================================
class FactCheckAnalyzer extends Analyzer {
    constructor(apiKey = null) {
        super();
        this.apiKey = apiKey || localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('FACT_CHECK_API_KEY');
        this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    }

    async analyze(article) {
        if (!this.apiKey) {
            return this.buildFallbackResult(
                "Fact-check API key is missing. Set 'GEMINI_API_KEY' in localStorage or pass it into constructor."
            );
        }

        const prompt = `You are an expert news fact-checker. Analyze the following news article for factual accuracy, known hoaxes, or misleading claims based on verified real-world knowledge.

Headline: "${article.headline}"
Source: "${article.sourceName}"
Body Context: "${article.body.slice(0, 1000)}"

Return ONLY a valid JSON object matching this structure:
{
  "rating": "True" | "Mostly True" | "Mixed" | "Mostly False" | "False" | "Unverified",
  "credibilityScore": <number 0-100>,
  "summary": "<Concise 2-3 sentence fact-check summary>",
  "keyEvidence": "<Key real-world evidence, context, or missing details>",
  "detectedClaims": ["<Claim 1>", "<Claim 2>"]
}`;

        try {
            const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API error HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rawText) {
                throw new Error("Empty response received from AI model.");
            }

            const aiResult = JSON.parse(rawText);
            const credibility = typeof aiResult.credibilityScore === "number"
                ? Math.min(100, Math.max(0, aiResult.credibilityScore))
                : 50;

            return {
                name: "AI Fact Check Analyzer",
                hasMatch: true,
                rating: aiResult.rating || "Unverified",
                credibility: credibility,
                suspicion: 100 - credibility,
                reason: aiResult.summary || "AI analysis completed.",
                details: {
                    evidence: aiResult.keyEvidence || "No explicit evidence provided.",
                    claims: aiResult.detectedClaims || []
                }
            };

        } catch (error) {
            console.error("AI Fact Check Analyzer Error:", error);
            return this.buildFallbackResult(`Fact-check lookup failed (${error.message}).`);
        }
    }

    buildFallbackResult(reason) {
        return {
            name: "AI Fact Check Analyzer",
            hasMatch: false,
            rating: "Unverified",
            credibility: 50,
            suspicion: 50,
            reason: reason,
            details: {
                evidence: "Unable to complete AI fact check.",
                claims: []
            }
        };
    }
}

// ==========================================
// CREDIBILITY REPORT
// ==========================================
class CredibilityReport {
    constructor(results) {
        this.results = results;
    }

    calculateOverallScore() {
        if (!this.results || !this.results.length) return 50;

        let totalWeight = 0;
        let weightedScore = 0;

        for (const res of this.results) {
            let weight = 1;

            if (res.name.includes("Source Reputation")) weight = 2.5;
            if (res.name.includes("Fact Check") && res.hasMatch) weight = 3.5;

            weightedScore += (res.credibility * weight);
            totalWeight += weight;
        }

        return Math.round(weightedScore / totalWeight);
    }

    getVerdict(score) {
        if (score >= 80) return { title: "Authentic", badgeClass: "success" };
        if (score >= 50) return { title: "Uncertain", badgeClass: "warning" };
        return { title: "Fake / Misleading", badgeClass: "danger" };
    }

    /**
     * Helper to render the complete analysis report to JSON or plain text log.
     */
    generateSummary() {
        const score = this.calculateOverallScore();
        const verdict = this.getVerdict(score);
        const aiCheck = this.results.find(r => r.name.includes("AI Fact Check"));

        return {
            overallScore: score,
            verdict: verdict.title,
            badgeClass: verdict.badgeClass,
            aiFactCheck: aiCheck ? {
                rating: aiCheck.rating,
                summary: aiCheck.reason,
                evidence: aiCheck.details?.evidence,
                claims: aiCheck.details?.claims
            } : null,
            breakdown: this.results
        };
    }
}
