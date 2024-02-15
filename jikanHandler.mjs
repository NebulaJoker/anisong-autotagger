import { createRequire } from "module";
import { initializeDateFromString, sanitizeEnglishTitle, jaccardIndex, waitTimeout } from "./generalUsage.mjs";
const require = createRequire(import.meta.url);
const { distance } = require('fastest-levenshtein');

const endpoint = "https://api.jikan.moe/v4/";

export async function getMALIDv5(title) {
    let requestURL = endpoint + "anime?q=" + encodeURIComponent(title);

    let possibilities = await fetch(requestURL)
        .then(response => response.json())
        .then(json => json)
        .catch(err => err)

    await waitTimeout(1);

    possibilities = possibilities.data.map((entry) => collectInformationV2(entry));

    possibilities = processEntryList(title, possibilities);

    return await addANNid(possibilities);
}


function processEntryList(title, choices) {

    title = title.toLowerCase().split(" ").filter((entry) => entry != " ").join(" ");

    let titleSplit = title.split(" ");
    let titleSplitSanitized = sanitizeEnglishTitle(title).toLowerCase().split(" ").filter((entry) => entry !== "");

    choices = choices.filter((entry) => entry.status === "Currently Airing" || entry.status === "Finished Airing")

    choices = choices.map((entry) => {
        let prio = getHighestProbabilityV2(titleSplit, titleSplitSanitized, entry.allTitles);
        entry.distance = prio.distance;
        entry.priority = prio.priority;
        return entry;
    })

    choices = choices.sort((entryA, entryB) => {
        if (entryB.priority === entryA.priority) {
            if (entryB.distance === entryA.distance) {
                return entryA.title.length - entryB.title.length;
            }
            else {
                return entryA.distance - entryB.distance
            }
        }
        else {
            return entryB.priority - entryA.priority;
        }
    })

    choices = choices.slice(0, 3).map((entry) => {
        delete entry.closestTitle;
        delete entry.distance;
        delete entry.priority;
        delete entry.allTitles;
        return entry;
    });

    return choices;

}


function getHighestProbabilityV2(filenameSplit, filenameSplitSanitized, allTitles) {

    let maxDistance = Number.MAX_SAFE_INTEGER;
    let maxJaccard = Number.MIN_SAFE_INTEGER;

    allTitles.forEach((entry) => {

        let entryLowercase = entry.toLowerCase();
        let entrySplit = entryLowercase.split(" ").filter((tit) => tit != "");
        let entrySanitized = sanitizeEnglishTitle(entry).toLowerCase().split(" ").filter((tit) => tit !== "").join(" ");
        let entrySanitizedSplit = entrySanitized.split(" ");

        let dist = distance(filenameSplit.join(" "), entryLowercase);

        let jaccard = jaccardIndex(filenameSplitSanitized, entrySanitizedSplit);

        if (jaccard > maxJaccard) {
            maxJaccard = jaccard;
            maxDistance = dist;
        }
        else if (jaccard === maxJaccard && dist < maxDistance) {
            maxJaccard = jaccard;
            maxDistance = dist;
        }
    })

    return {
        distance: maxDistance,
        priority: maxJaccard
    }
}





function getYear(year, airdate) {
    if (year == null) {
        return initializeDateFromString(airdate).getFullYear();
    }
    else {
        return year
    };
}


function collectInformationV2(entry) {
    return {
        "malID": entry.mal_id,
        "image": entry.images.jpg.image_url,
        "title": entry.title,
        "type": entry.type,
        "year": getYear(entry.year, entry.aired.from),
        "season": entry.season,
        "genres": compressGenres(entry.genres, entry.explicit_genres, entry.themes),
        "airdate": {
            "from": initializeDateFromString(entry.aired.from),
            "to": initializeDateFromString(entry.aired.to)
        },
        "englishTitle": (entry.title_english || null),
        "japaneseTitle": (entry.title_japanese || null),
        "allTitles": getAllTitles(entry),
        "status": entry.status
    }
}


function getAllTitles(choice) {
    return Object.values(choice.titles).map((entry) => {
        if (["English", "Synonym", "Default"].includes(entry.type))
            return entry.title;
    }
    ).filter((entry) => typeof entry === "string")
}







function compressGenres(genres, explicitGenres, themes) {
    let allGenres = ["Anisong"];

    for (const genre of genres) {
        allGenres.push(genre.name)
    }

    for (const genre of explicitGenres) {
        allGenres.push(genre.name)
    }

    for (const genre of themes) {
        allGenres.push(genre.name)
    }

    return allGenres;
}


async function addANNid(possibilities) {

    for (let i = 0; i < possibilities.length; ++i) {
        let requestURL = endpoint + "anime/" + encodeURIComponent(possibilities[i].malID) + "/full";

        let annID = await fetch(requestURL)
            .then(response => response.json())
            .then(json => json.data.external)
            .catch(err => err)

        try {
            annID = annID.filter((entry) => entry.name === "ANN" || entry.name === "AnimeNewsNetwork" || entry.name === "Anime News Network");
            annID = annID[0].url;
            annID = ((annID.split("?")[1]).split("="))[1];

            possibilities[i].annID = Number.parseInt(annID)
        }
        catch {
            annID = null;
        }
    }

    return possibilities;

}