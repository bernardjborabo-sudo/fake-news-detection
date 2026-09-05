/*
    Fake News Detection System

    Rule-based implementation using:
    - Article
    - Source
    - Analyzer
    - KeywordAnalyzer
    - SourceAnalyzer
    - SimilarityAnalyzer
    - CredibilityReport
    - NewsDatabase
*/


const SUPABASE_URL = "https://phcnrnprkndjhztrvauh.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_deV_4p8S9sIjtb5tuHy82w_ENfY2y-t";

const supabaseClient =
    window.supabase.creatClient(
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

        // Hash Set equivalent

        this.keywords = new Set([

            "shocking",

            "breaking",

            "you won't believe",

            "unbelievable",

            "secret",

            "exposed",

            "miracle",

            "urgent",

            "100% proof",

            "must see",

            "share now",

            "viral",

            "scandal",

            "destroyed",

            "guaranteed",

            "truth they don't want you to know"

        ]);
    }


    analyze(article) {

        const text =
            `${article.headline} ${article.body}`;

        const lower =
            text.toLowerCase();


        // Find suspicious keywords

        const hits =
            [...this.keywords]
                .filter(keyword =>
                    lower.includes(keyword)
                );


        // Check capitalization

        const letters =
            text.replace(
                /[^A-Za-z]/g,
                ""
            );


        const upperLetters =
            letters.replace(
                /[^A-Z]/g,
                ""
            );


        const capsRatio =
            letters.length
                ? upperLetters.length /
                  letters.length
                : 0;


        // Check punctuation

        const punctuationMatches =
            text.match(
                /[!?]{2,}|\.{3,}/g
            ) || [];


        let suspicion = 0;


        // Keyword score

        suspicion += Math.min(
            45,
            hits.length * 9
        );


        // Capitalization score

        if (capsRatio > 0.35) {

            suspicion += 25;

        } else if (capsRatio > 0.20) {

            suspicion += 12;
        }


        // Punctuation score

        suspicion += Math.min(
            30,
            punctuationMatches.length * 6
        );


        suspicion =
            Math.min(
                100,
                Math.round(suspicion)
            );


        const reasons = [];


        if (hits.length) {

            reasons.push(
                `Found ${hits.length} sensational/clickbait pattern(s): ` +
                `${hits.slice(0, 4).join(", ")}` +
                `${hits.length > 4 ? "..." : ""}.`
            );
        }


        if (capsRatio > 0.35) {

            reasons.push(
                "Excessive capitalization detected."
            );

        } else if (capsRatio > 0.20) {

            reasons.push(
                "Higher-than-usual capitalization detected."
            );
        }


        if (punctuationMatches.length) {

            reasons.push(
                "Excessive punctuation detected."
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

        // Hash Map equivalent

        this.sourceTable =
            new Map(
                Object.entries(sourceTable)
            );
    }


    analyze(article) {

        const key =
            article.sourceName.toLowerCase();


        const source =
            this.sourceTable.get(key)
            ||
            new Source(
                article.sourceName,
                "unverified",
                50
            );


        let suspicion;


        if (
            source.rating === "trusted"
        ) {

            suspicion = 0;

        } else if (
            source.rating === "blacklisted"
        ) {

            suspicion = 90;

        } else {

            suspicion = 45;
        }


        let reason;


        if (
            source.rating === "trusted"
        ) {

            reason =
                `Source "${article.sourceName}" is on the trusted-source list.`;

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
                                word.length > 3
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

                if (
                    bodyWords.has(word)
                ) {

                    overlap++;
                }
            }
        );


        const similarity =
            overlap /
            headlineWords.size;


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


        return {

            name:
                "Headline/Body Similarity Analyzer",

            suspicion:
                suspicion,

            credibility:
                100 - suspicion,

            reason:
                `Approximately ${Math.round(
                    similarity * 100
                )}% of meaningful headline words also appear in the article body.`
        };
    }
}



// ==========================================
// CREDIBILITY REPORT
// ==========================================

class CredibilityReport {

    constructor(results) {

        this.results = results;


        // Weighted scoring

        const weights = {

            "Source Reputation Analyzer":
                0.35,

            "Keyword & Text Pattern Analyzer":
                0.40,

            "Headline/Body Similarity Analyzer":
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

    constructor() {

        this.history =
            JSON.parse(
                localStorage.getItem(
                    "fakeNewsHistory"
                ) || "[]"
            );
    }


    save(
        article,
        report
    ) {

        const record = {

            id:
                Date.now(),

            article:
                article,

            credibility:
                report.credibility,

            suspicion:
                report.suspicion,

            verdict:
                report.verdict
        };


        this.history.push(record);


        localStorage.setItem(

            "fakeNewsHistory",

            JSON.stringify(
                this.history
            )
        );
    }


    clear() {

        this.history = [];


        localStorage.removeItem(
            "fakeNewsHistory"
        );
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

        new Source(
            "Reuters",
            "trusted",
            95
        ),


    "bbc":

        new Source(
            "BBC",
            "trusted",
            90
        ),


    "associated press":

        new Source(
            "Associated Press",
            "trusted",
            90
        ),


    "ap":

        new Source(
            "Associated Press",
            "trusted",
            90
        ),


    "philippine daily inquirer":

        new Source(
            "Philippine Daily Inquirer",
            "trusted",
            85
        ),


    "rappler":

        new Source(
            "Rappler",
            "trusted",
            80
        ),


    "example-blacklist.com":

        new Source(
            "example-blacklist.com",
            "blacklisted",
            10
        )
};



// ==========================================
// CREATE OBJECTS
// ==========================================

const database =
    new NewsDatabase();


const analyzers = [

    new SourceAnalyzer(
        knownSources
    ),

    new KeywordAnalyzer(),

    new SimilarityAnalyzer()
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
        database.getMostSuspicious();


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
        event => {

            event.preventDefault();


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

            database.save(
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
        () => {

            if (
                !database.history.length
            ) {

                return;
            }


            if (
                confirm(
                    "Clear all saved analysis history?"
                )
            ) {

                database.clear();

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
// LOAD HISTORY
// ==========================================

renderHistory();
