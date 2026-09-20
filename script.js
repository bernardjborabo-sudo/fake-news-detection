/*
    Fake News Detection System

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


// ==========================================
// LEVENSHTEIN DISTANCE (edit distance)
// ==========================================
// Classic dynamic-programming DSA algorithm. Used by SourceAnalyzer
// to catch "impersonation" source names — fake outlets that mimic a
// trusted brand with a small typo or extra word, e.g. "Reutters",
// "BBC-News-Now", "The New York Times Today". A plain equality or
// substring check misses these; edit distance catches "close but
// not exact" matches.

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
// Shared by SourceAnalyzer for both the lookup table's keys and the
// user-typed source name, so "Reuters", "reuters.com", and
// "www.reuters.com" all normalize to the same key. Previously this
// was only applied to the typed name, not the table's own keys —
// meaning any key containing punctuation (e.g. "example-blacklist
// .com") could silently fail to match itself.

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
// KEYWORD ANALYZER
// ==========================================

class KeywordAnalyzer
    extends Analyzer {

    constructor() {

        super();

        // Hash Map equivalent: phrase -> severity weight.
        // Higher weight = stronger clickbait/sensationalism signal.
        // Splitting into tiers avoids treating "breaking" (common,
        // legitimate in real news) the same as "truth they don't
        // want you to know" (almost always bait).

        this.keywords = new Map([

            // Tier 1: mild / commonly used even by real outlets
            ["breaking", 3],
            ["urgent", 4],
            ["exclusive", 3],
            ["viral", 4],
            ["scandal", 4],

            // Tier 2: moderate sensationalism
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

            // Tier 3: strong clickbait / manipulation phrasing
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

        const text =
            `${article.headline} ${article.body}`;

        const lower =
            text.toLowerCase();


        // Find suspicious keyword/phrase hits, weighted by severity.
        // Use word-boundary-aware matching for single words so we
        // don't match substrings inside unrelated words; multi-word
        // phrases are matched as plain substrings since word
        // boundaries on both ends already make false positives rare.

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


        const keywordScore =
            hits.reduce(
                (sum, hit) => sum + hit.weight,
                0
            );


        // Check capitalization — per WORD, not per letter.
        // A raw letter-based ratio unfairly flags short, normal
        // text containing a couple of acronyms (e.g. "US", "UN").
        // Instead, count words that are entirely uppercase, at
        // least 3 letters long (so "I", "A", "US", "UK" don't
        // count), and exclude a short allow-list of common
        // legitimate acronyms.

        const commonAcronyms = new Set([
            "usa", "uk", "un", "eu", "who", "nba", "nfl", "ceo",
            "faq", "fbi", "cia", "gdp", "covid", "ai", "us",
            // News-organization acronyms, so headlines/bodies that
            // simply mention a real outlet by its short name aren't
            // mistaken for "shouting".
            "bbc", "cnn", "npr", "abc", "nbc", "cbs", "fox", "afp",
            "upi", "pbs", "nyt", "wsj", "ap", "pna", "gma",
            "nasa", "fda", "cdc", "nato", "dna", "gps"
        ]);

        const words =
            text.match(/[A-Za-z']+/g) || [];

        const shoutWords =
            words.filter(word =>
                word.length >= 3 &&
                word === word.toUpperCase() &&
                /[A-Z]/.test(word) &&
                !commonAcronyms.has(word.toLowerCase())
            );

        const shoutRatio =
            words.length
                ? shoutWords.length / words.length
                : 0;


        // Check punctuation: both "runs" (!!!, ??, ...) AND overall
        // exclamation-mark density, since a single "!!!" and ten
        // separate "!" convey similarly manipulative tone but the
        // old check only caught the former.

        const punctuationRuns =
            text.match(
                /[!?]{2,}|\.{3,}/g
            ) || [];

        const exclamationCount =
            (text.match(/!/g) || []).length;


        let suspicion = 0;


        // Keyword score (weighted, capped)

        suspicion += Math.min(45, keywordScore);


        // Capitalization ("shouting") score

        if (shoutRatio > 0.15) {

            suspicion += 25;

        } else if (shoutRatio > 0.07) {

            suspicion += 12;
        }


        // Punctuation score: runs + density, capped combined

        let punctuationScore =
            Math.min(20, punctuationRuns.length * 6);

        if (exclamationCount >= 5) {

            punctuationScore += 10;

        } else if (exclamationCount >= 2) {

            punctuationScore += 5;
        }

        suspicion += Math.min(30, punctuationScore);


        suspicion =
            Math.min(
                100,
                Math.round(suspicion)
            );


        const reasons = [];


        if (hits.length) {

            const names = hits
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 4)
                .map(hit => hit.phrase);

            reasons.push(
                `Found ${hits.length} sensational/clickbait pattern(s): ` +
                `${names.join(", ")}` +
                `${hits.length > 4 ? "..." : ""}.`
            );
        }


        if (shoutRatio > 0.15) {

            reasons.push(
                "Excessive capitalized words detected."
            );

        } else if (shoutRatio > 0.07) {

            reasons.push(
                "Higher-than-usual number of capitalized words detected."
            );
        }


        if (punctuationRuns.length) {

            reasons.push(
                "Excessive punctuation runs (e.g. \"!!!\") detected."
            );
        }

        if (exclamationCount >= 2) {

            reasons.push(
                `${exclamationCount} exclamation marks found in the text.`
            );
        }


        if (!reasons.length) {

            reasons.push(
                "No major clickbait, capitalization, or punctuation pattern was detected."
            );
        }


        return {

            name:
                "Keyword & Text Pattern Analyzer",

            suspicion: suspicion,

            credibility:
                100 - suspicion,

            reason:
                reasons.join(" ")
        };
    }
}



// ==========================================
// SOURCE ANALYZER
// ==========================================

class SourceAnalyzer
    extends Analyzer {

    constructor(sourceTable) {

        super();

        // Hash Map equivalent. Keys are normalized here too (not
        // just the incoming article's source name) — otherwise a
        // table key containing punctuation, like
        // "example-blacklist.com", would never match its own
        // normalized form and would silently fall through to
        // "unverified" instead of "blacklisted".

        this.sourceTable =
            new Map(
                Object.entries(sourceTable)
                    .map(([key, source]) =>
                        [normalizeSourceName(key), source]
                    )
            );

        // Precompute the list of trusted-source keys once, so each
        // analyze() call doesn't have to re-filter the whole table
        // just to run the impersonation check below.

        this.trustedKeys =
            [...this.sourceTable.entries()]
                .filter(([, source]) => source.rating === "trusted")
                .map(([key]) => key);
    }


    analyze(article) {

        const key = normalizeSourceName(article.sourceName);

        const exactMatch = this.sourceTable.get(key);


        // If there's no exact match, check whether the name is
        // SUSPICIOUSLY CLOSE to a known trusted source — a classic
        // fake-news tactic is registering "Reutters" or "BBC-News-
        // Now" to borrow a real outlet's credibility. Edit distance
        // catches this; a plain equality check can't.

        let impersonationTarget = null;

        if (!exactMatch && key.length >= 4) {

            let bestDistance = Infinity;
            let bestKey = null;

            for (const trustedKey of this.trustedKeys) {

                const distance =
                    levenshteinDistance(key, trustedKey);

                if (distance < bestDistance) {

                    bestDistance = distance;
                    bestKey = trustedKey;
                }
            }

            // A small edit distance relative to name length means
            // "very close but not identical" — exactly what a
            // typosquatted or copycat name looks like. Require
            // distance > 0 so an actual exact match (already
            // handled above) isn't double-flagged.

            if (
                bestKey &&
                bestDistance > 0 &&
                bestDistance <= 2
            ) {

                impersonationTarget =
                    this.sourceTable.get(bestKey).name;
            }
        }


        const source =
            exactMatch
            ||
            new Source(
                article.sourceName,
                "unverified",
                50
            );


        let suspicion;
        let isBlacklisted = false;


        if (impersonationTarget) {

            // Treat likely impersonation as seriously as an
            // outright blacklisted source: borrowing a trusted
            // brand's near-identical name is a strong deception
            // signal on its own, regardless of article content.

            suspicion = 88;
            isBlacklisted = true;

        } else {

            // Use the source's continuous "weight" (0-100 trust
            // score) rather than only three flat buckets. This lets
            // two "unverified" sources, or two "trusted" sources,
            // still be told apart if their known reputational
            // weight differs — a graduated score is more accurate
            // than a step function.

            suspicion =
                Math.round(100 - source.weight);


            // Still respect the rating as a hard floor/ceiling so a
            // blacklisted source can never look better than "very
            // suspicious", and a trusted source never worse than
            // "fairly credible", regardless of its numeric weight.

            if (source.rating === "blacklisted") {

                suspicion = Math.max(suspicion, 80);
                isBlacklisted = true;

            } else if (source.rating === "trusted") {

                suspicion = Math.min(suspicion, 20);

            } else {

                // unverified: keep within a moderate suspicion band
                suspicion = Math.min(Math.max(suspicion, 35), 65);
            }
        }


        let reason;


        if (impersonationTarget) {

            reason =
                `Source "${article.sourceName}" closely resembles the trusted outlet ` +
                `"${impersonationTarget}" but does not match it exactly — this is a common ` +
                `impersonation/typosquatting pattern.`;

        } else if (
            source.rating === "trusted"
        ) {

            reason =
                `Source "${article.sourceName}" is on the trusted-source list (trust weight ${source.weight}/100).`;

        } else if (
            source.rating === "blacklisted"
        ) {

            reason =
                `Source "${article.sourceName}" is on the blacklisted-source list.`;

        } else {

            reason =
                `Source "${article.sourceName}" is not in the known-source table, so it is treated as unverified.`;
        }


        return {

            name:
                "Source Reputation Analyzer",

            suspicion:

                suspicion,

            credibility:
                100 - suspicion,

            isBlacklisted:
                isBlacklisted,

            reason:
                reason
        };
    }
}



// ==========================================
// SIMILARITY ANALYZER
// ==========================================

class SimilarityAnalyzer
    extends Analyzer {

    constructor() {

        super();

        // Common function words to ignore. Without this, matching
        // words like "that", "with", or "have" inflate the overlap
        // score without telling us anything about actual topical
        // similarity between headline and body.

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

        const tokenize =
            text =>

                new Set(

                    text
                        .toLowerCase()

                        .replace(
                            /[^a-z0-9\s]/g,
                            " "
                        )

                        .split(/\s+/)

                        .filter(
                            word =>
                                word.length > 3 &&
                                !this.stopwords.has(word)
                        )
                );


        const headlineWords =
            tokenize(
                article.headline
            );


        const bodyWords =
            tokenize(
                article.body
            );


        if (
            !headlineWords.size ||
            !bodyWords.size
        ) {

            return {

                name:
                    "Headline/Body Similarity Analyzer",

                suspicion: 50,

                credibility: 50,

                reason:
                    "Not enough text was provided for a meaningful similarity check."
            };
        }


        let overlap = 0;

        headlineWords.forEach(
            word => {

                if (bodyWords.has(word)) {

                    overlap++;
                }
            }
        );


        // "Recall": how much of the headline's claim is actually
        // discussed in the body (the original metric).

        const recall =
            overlap / headlineWords.size;


        // "Jaccard": overlap relative to the UNION of both word
        // sets. This adds sensitivity the old metric lacked: a
        // headline can score high on recall just by using a couple
        // of generic words that also happen to appear in a long,
        // unrelated body — Jaccard is harder to game that way
        // because a large, mostly-unrelated body pulls the union
        // up and the score down.

        const union =
            new Set([...headlineWords, ...bodyWords]).size;

        const jaccard =
            overlap / union;


        // Blend both signals. Recall answers "is the headline's
        // topic covered?"; Jaccard answers "how much of the overall
        // vocabulary is actually shared?". Weighting recall higher
        // keeps the metric close to its original intent while
        // Jaccard corrects for headline words that are too generic
        // to mean much on their own.

        const similarity =
            (recall * 0.7) + (jaccard * 0.3);


        let suspicion =
            Math.round(
                (1 - similarity) * 100
            );


        suspicion =
            Math.max(
                0,
                Math.min(
                    100,
                    suspicion
                )
            );


        const reason =
            `Approximately ${Math.round(recall * 100)}% of meaningful ` +
            `headline words also appear in the article body ` +
            `(topical overlap score: ${Math.round(similarity * 100)}%).`;


        return {

            name:
                "Headline/Body Similarity Analyzer",

            suspicion:
                suspicion,

            credibility:
                100 - suspicion,

            reason:
                reason
        };
    }
}



// ==========================================
// ATTRIBUTION & LANGUAGE ANALYZER
// ==========================================
// Checks for vague-sourcing phrases ("sources say", "many believe")
// and absolutist/loaded language ("always", "everyone", "no one"),
// both of which are common in fabricated or unverifiable stories.
// Gives partial credit back for genuine attribution markers (direct
// quotes, "according to", named "X said" constructions), since
// well-sourced reporting should legitimately score lower suspicion.

class AttributionAnalyzer
    extends Analyzer {

    constructor() {

        super();

        // Hash Map equivalent: phrase -> severity weight

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

        const text =
            `${article.headline} ${article.body}`;

        const lower =
            text.toLowerCase();


        const vagueHits = [];

        for (const [phrase, weight] of this.vaguePhrases) {

            if (lower.includes(phrase)) {

                vagueHits.push({ phrase, weight });
            }
        }


        const absolutistHits =
            this.absolutistWords.filter(
                word =>
                    new RegExp(`\\b${word}\\b`, "i").test(lower)
            );


        // Positive signals: real reporting usually contains direct
        // quotes and clear attribution ("according to...", "X said
        // ..."). Their presence should lower suspicion, not just
        // the absence of red flags raise it.

        const quoteCount =
            (text.match(/["“”]/g) || []).length;

        const hasAccordingTo =
            /according to/i.test(text);

        const namedAttribution =
            /\b[A-Z][a-z]+ (?:said|stated|told|explained|confirmed|announced)\b/
                .test(text);


        let suspicion = 0;


        suspicion += Math.min(
            35,
            vagueHits.reduce((sum, hit) => sum + hit.weight, 0)
        );


        suspicion += Math.min(
            20,
            absolutistHits.length * 7
        );


        let attributionCredit = 0;

        if (quoteCount >= 2) attributionCredit += 10;
        if (hasAccordingTo) attributionCredit += 8;
        if (namedAttribution) attributionCredit += 10;

        suspicion = Math.max(0, suspicion - attributionCredit);

        suspicion =
            Math.min(100, Math.round(suspicion));


        const reasons = [];


        if (vagueHits.length) {

            const names = vagueHits
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 3)
                .map(hit => hit.phrase);

            reasons.push(
                `Found ${vagueHits.length} vague-sourcing phrase(s): ` +
                `${names.join(", ")}` +
                `${vagueHits.length > 3 ? "..." : ""}.`
            );
        }


        if (absolutistHits.length) {

            reasons.push(
                `Absolutist language detected (${absolutistHits.slice(0, 3).join(", ")}).`
            );
        }


        if (attributionCredit > 0) {

            reasons.push(
                "Direct quotes or clear named attribution were found, which supports credibility."
            );
        }


        if (!reasons.length) {

            reasons.push(
                "No notable vague-sourcing or absolutist language patterns were detected."
            );
        }


        return {

            name:
                "Attribution & Language Analyzer",

            suspicion: suspicion,

            credibility:
                100 - suspicion,

            reason:
                reasons.join(" ")
        };
    }
}



// ==========================================
// CREDIBILITY REPORT
// ==========================================

class CredibilityReport {

    constructor(results) {

        this.results = results;


        // Weighted scoring. Rebalanced now that a 4th analyzer
        // (Attribution & Language) contributes a signal that used
        // to have no home — vague sourcing and loaded language
        // aren't clickbait keywords, but they're just as telling.

        const weights = {

            "Source Reputation Analyzer":
                0.30,

            "Keyword & Text Pattern Analyzer":
                0.30,

            "Headline/Body Similarity Analyzer":
                0.15,

            "Attribution & Language Analyzer":
                0.25
        };


        this.credibility =
            Math.round(

                results.reduce(

                    (sum, result) =>

                        sum +
                        result.credibility *
                        weights[result.name],

                    0
                )
            );


        // Hard override: a blacklisted or impersonating source is
        // disqualifying on its own. Without this, a fake outlet
        // that writes cleanly (no clickbait words, decent
        // attribution) could still average out to "Uncertain" or
        // better, even though its source alone is a red flag no
        // amount of good prose should outweigh.

        const hasDisqualifyingSource =
            results.some(result => result.isBlacklisted);

        if (hasDisqualifyingSource) {

            this.credibility =
                Math.min(this.credibility, 25);
        }


        this.suspicion =
            100 -
            this.credibility;


        // Verdict

        if (
            this.credibility >= 70
        ) {

            this.verdict =
                "Likely Reliable";

        } else if (
            this.credibility >= 45
        ) {

            this.verdict =
                "Uncertain";

        } else {

            this.verdict =
                "Likely Fake";
        }
    }
}



// ==========================================
// NEWS DATABASE
// ==========================================

class NewsDatabase {

    constructor(userId) {

        // Each signed-in user only ever sees rows
        // where history.user_id matches their own id
        // (enforced server-side by Row Level Security)

        this.userId = userId;

        this.history = [];
    }


    async load() {

        const { data, error } =
            await supabaseClient
                .from("history")
                .select("*")
                .eq("user_id", this.userId)
                .order("created_at", { ascending: false });


        if (error) {

            console.error(
                "Failed to load history:",
                error.message
            );

            this.history = [];

            return;
        }


        this.history = data;
    }


    async save(
        article,
        report
    ) {

        const { data, error } =
            await supabaseClient
                .from("history")
                .insert({

                    user_id:
                        this.userId,

                    article:
                        article,

                    credibility:
                        report.credibility,

                    suspicion:
                        report.suspicion,

                    verdict:
                        report.verdict
                })
                .select()
                .single();


        if (error) {

            console.error(
                "Failed to save history:",
                error.message
            );

            return;
        }


        this.history.unshift(data);
    }


    async clear() {

        const { error } =
            await supabaseClient
                .from("history")
                .delete()
                .eq("user_id", this.userId);


        if (error) {

            console.error(
                "Failed to clear history:",
                error.message
            );

            return;
        }


        this.history = [];
    }


    getMostSuspicious() {

        return [

            ...this.history

        ].sort(

            (a, b) =>
                b.suspicion -
                a.suspicion
        );
    }
}



// ==========================================
// KNOWN SOURCES
// ==========================================

const knownSources = {

    "reuters":
        new Source("Reuters", "trusted", 95),

    "bbc":
        new Source("BBC", "trusted", 92),

    "associated press":
        new Source("Associated Press", "trusted", 93),

    "ap":
        new Source("Associated Press", "trusted", 93),

    "the new york times":
        new Source("The New York Times", "trusted", 85),

    "nytimes":
        new Source("The New York Times", "trusted", 85),

    "npr":
        new Source("NPR", "trusted", 88),

    "the guardian":
        new Source("The Guardian", "trusted", 82),

    "philippine daily inquirer":
        new Source("Philippine Daily Inquirer", "trusted", 85),

    "inquirer":
        new Source("Philippine Daily Inquirer", "trusted", 85),

    "rappler":
        new Source("Rappler", "trusted", 82),

    "gma news":
        new Source("GMA News", "trusted", 80),

    "abscbn news":
        new Source("ABS-CBN News", "trusted", 80),

    "philstar":
        new Source("The Philippine Star", "trusted", 78),

    "pna":
        new Source("Philippine News Agency", "trusted", 80),

    // Known low-quality / satire / clickbait-farm style outlets.
    // Weight is low but not zero — "blacklisted" plus the floor in
    // SourceAnalyzer already guarantees a high suspicion score.

    "example-blacklist.com":
        new Source("example-blacklist.com", "blacklisted", 10),

    "worldnewsdailyreport":
        new Source("World News Daily Report", "blacklisted", 5),

    "the onion":
        new Source("The Onion", "blacklisted", 15) // satire, not "fake" per se, but not a news source
};



// ==========================================
// CREATE OBJECTS
// ==========================================

// Created once a user is signed in (see AUTH section near the bottom)

let database = null;


const analyzers = [

    new SourceAnalyzer(
        knownSources
    ),

    new KeywordAnalyzer(),

    new SimilarityAnalyzer(),

    new AttributionAnalyzer()
];



// ==========================================
// HELPER FUNCTIONS
// ==========================================

const $ =
    id =>
        document.getElementById(id);



function escapeHtml(value) {

    return String(value).replace(

        /[&<>"']/g,

        character => ({

            "&": "&amp;",

            "<": "&lt;",

            ">": "&gt;",

            '"': "&quot;",

            "'": "&#039;"

        }[character])
    );
}



function verdictClass(
    verdict
) {

    if (
        verdict === "Likely Reliable"
    ) {

        return "good";
    }


    if (
        verdict === "Uncertain"
    ) {

        return "warn";
    }


    return "bad";
}



// ==========================================
// DISPLAY REPORT
// ==========================================

function renderReport(
    report
) {

    const className =
        verdictClass(
            report.verdict
        );


    // Verdict pill

    $("verdictPill").className =
        `pill ${className}`;


    $("verdictPill").textContent =
        report.verdict;


    // Score

    $("scoreRing").style
        .setProperty(
            "--score",
            report.credibility
        );


    $("scoreValue").textContent =
        `${report.credibility}%`;


    // Verdict title

    $("verdictTitle").textContent =
        report.verdict;


    // Verdict message

    if (
        report.verdict ===
        "Likely Reliable"
    ) {

        $("verdictText").textContent =
            "The article shows relatively few suspicious patterns. Manual fact-checking is still recommended.";

    } else if (
        report.verdict ===
        "Uncertain"
    ) {

        $("verdictText").textContent =
            "The article contains mixed signals. Treat it cautiously and verify important claims.";

    } else {

        $("verdictText").textContent =
            "The article shows several suspicious patterns. Do not treat this result as proof; verify the claims independently.";
    }


    // Analyzer results

    $("analyzerResults").innerHTML =

        report.results.map(

            result => `

                <div class="analyzer">

                    <div class="analyzer-top">

                        <span class="analyzer-name">
                            ${escapeHtml(
                                result.name
                            )}
                        </span>

                        <span class="analyzer-score">
                            ${result.credibility}% credibility
                        </span>

                    </div>


                    <div class="progress">

                        <div
                            style="width:${result.credibility}%"
                        ></div>

                    </div>


                    <small>
                        ${escapeHtml(
                            result.reason
                        )}
                    </small>

                </div>

            `
        ).join("");
}



// ==========================================
// DISPLAY HISTORY
// ==========================================

function renderHistory() {

    const history =
        database
            ? database.getMostSuspicious()
            : [];


    $("historyCount").textContent =

        `${history.length} check${
            history.length === 1
                ? ""
                : "s"
        }`;


    if (!history.length) {

        $("historyList").innerHTML =
            `<div class="empty-state">
                No previous checks.
            </div>`;

        return;
    }


    $("historyList").innerHTML =

        history.map(

            item => `

                <div class="history-item">

                    <div>

                        <p class="history-title">
                            ${escapeHtml(
                                item.article.headline
                            )}
                        </p>

                        <p class="history-meta">
                            ${escapeHtml(
                                item.article.sourceName
                            )}
                            •
                            ${escapeHtml(
                                item.article.date
                            )}
                            •
                            ${escapeHtml(
                                item.verdict
                            )}
                        </p>

                    </div>


                    <div class="suspicion">

                        ${item.suspicion}%

                        <small>
                            suspicion
                        </small>

                    </div>

                </div>

            `
        ).join("");
}



// ==========================================
// ANALYZE FORM
// ==========================================

$("newsForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (!database) {

                return;
            }


            const article =
                new Article(

                    $("headline").value,

                    $("body").value,

                    $("source").value,

                    $("date").value
                );


            // Run all analyzers

            const results =
                analyzers.map(

                    analyzer =>
                        analyzer.analyze(
                            article
                        )
                );


            // Create report

            const report =
                new CredibilityReport(
                    results
                );


            // Display

            renderReport(
                report
            );


            // Save

            await database.save(
                article,
                report
            );


            // Refresh history

            renderHistory();
        }
    );



// ==========================================
// RESET
// ==========================================

$("resetBtn")
    .addEventListener(
        "click",
        () => {

            $("newsForm").reset();


            $("scoreRing")
                .style
                .setProperty(
                    "--score",
                    0
                );


            $("scoreValue")
                .textContent = "--";


            $("verdictPill").className =
                "pill neutral";


            $("verdictPill").textContent =
                "Not analyzed";


            $("verdictTitle")
                .textContent =
                "Ready to analyze";


            $("verdictText")
                .textContent =
                "Enter a headline, source, and article text, then click Analyze Credibility.";


            $("analyzerResults")
                .innerHTML =
                `<div class="empty-state">
                    No analyzer results yet.
                </div>`;
        }
    );



// ==========================================
// CLEAR HISTORY
// ==========================================

$("clearAllBtn")
    .addEventListener(
        "click",
        async () => {

            if (
                !database ||
                !database.history.length
            ) {

                return;
            }


            if (
                confirm(
                    "Clear all saved analysis history?"
                )
            ) {

                await database.clear();

                renderHistory();
            }
        }
    );



// ==========================================
// SAMPLE ARTICLE
// ==========================================

$("sampleBtn")
    .addEventListener(
        "click",
        () => {

            $("headline").value =
                "BREAKING!!! SHOCKING SECRET THEY DON'T WANT YOU TO KNOW";


            $("source").value =
                "Unknown Daily";


            $("date").value =
                new Date()
                    .toISOString()
                    .slice(
                        0,
                        10
                    );


            $("body").value =
                "A report claims that officials announced a major change today. The article asks readers to share the story immediately, but provides few verifiable details or supporting sources. Readers should check the original announcement and compare the claim with reports from established news organizations.";
        }
    );



// ==========================================
// AUTH: MODE SWITCHING (Log In / Sign Up)
// ==========================================

let authMode = "login";


function setAuthMode(mode) {

    authMode = mode;


    document
        .querySelectorAll(".auth-tab")
        .forEach(tab =>
            tab.classList.toggle(
                "active",
                tab.dataset.mode === mode
            )
        );


    $("authSubmitBtn").textContent =
        mode === "login"
            ? "Log In"
            : "Create Account";


    $("authError").hidden = true;
    $("authNotice").hidden = true;
}


document
    .querySelectorAll(".auth-tab")
    .forEach(tab => {

        tab.addEventListener(
            "click",
            () =>
                setAuthMode(tab.dataset.mode)
        );
    });



// ==========================================
// AUTH: FRIENDLY ERROR MESSAGES
// ==========================================

function authErrorMessage(error) {

    const raw =
        error?.message || "";


    if (raw.includes("Invalid login credentials")) {

        return "Incorrect email or password.";
    }

    if (raw.includes("User already registered")) {

        return "An account with that email already exists. Try logging in instead.";
    }

    if (raw.includes("Password should be at least")) {

        return "Password must be at least 6 characters.";
    }

    if (raw.includes("Unable to validate email address")) {

        return "That email address doesn't look valid.";
    }


    return raw || "Something went wrong. Please try again.";
}



// ==========================================
// AUTH: FORM SUBMIT (LOGIN OR SIGN UP)
// ==========================================

$("authForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            $("authError").hidden = true;
            $("authNotice").hidden = true;


            const email =
                $("authEmail").value.trim();

            const password =
                $("authPassword").value;


            if (authMode === "login") {

                const { error } =
                    await supabaseClient.auth
                        .signInWithPassword({
                            email,
                            password
                        });


                if (error) {

                    $("authError").hidden = false;

                    $("authError").textContent =
                        authErrorMessage(error);
                }

                // On success, onAuthStateChange (below)
                // takes care of showing the app.

            } else {

                const { data, error } =
                    await supabaseClient.auth
                        .signUp({
                            email,
                            password
                        });


                if (error) {

                    $("authError").hidden = false;

                    $("authError").textContent =
                        authErrorMessage(error);

                    return;
                }


                if (!data.session) {

                    // Email confirmation is required by
                    // this Supabase project's auth settings

                    $("authNotice").hidden = false;

                    $("authNotice").textContent =
                        "Account created! Check your email to confirm it, then log in.";

                    setAuthMode("login");
                }

                // If data.session exists, email confirmation
                // is off and onAuthStateChange logs them in
                // automatically.
            }
        }
    );



// ==========================================
// AUTH: SIGN OUT
// ==========================================

$("signOutBtn")
    .addEventListener(
        "click",
        () => {

            supabaseClient.auth.signOut();
        }
    );



// ==========================================
// AUTH: STATE CHANGE (GATES THE WHOLE APP)
// ==========================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        if (session?.user) {

            // Signed in: show the app, load their history

            $("authScreen").hidden = true;
            $("appShell").hidden = false;

            $("userEmail").textContent =
                session.user.email;


            database =
                new NewsDatabase(session.user.id);

            await database.load();

            renderHistory();

        } else {

            // Signed out: show the auth gate, hide the app

            database = null;

            $("appShell").hidden = true;
            $("authScreen").hidden = false;

            $("authForm").reset();

            setAuthMode("login");
        }
    }
);
