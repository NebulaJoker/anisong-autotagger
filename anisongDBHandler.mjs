import fetch from "node-fetch";
import fs from 'fs'
import { waitTimeout, sanitizeEnglishTitle } from "./generalUsage.mjs";
import { getTags } from "./musicTagging.mjs";
import { testValidity } from "./testSuite.mjs";
import { distance } from "fastest-levenshtein";


const englishDubArtists = JSON.parse(fs.readFileSync("./caches/dubSongBlacklist.json") || {})

const options = {
    method: "post",
    body: "",
    headers: {
        'Content-Type': 'application/json'
    }
}


export async function searchAnisongDB(annID) {
    let result = await searchAnisongDBannID(annID.toString());
    result = checkForExistance(result, annID);

    if (result.length === 0) {
        return null;
    }

    return result[0].music;
}


async function searchAnisongDBannID(annID) {
    updateRequest(annID, annID, annID, false);

    const response = await fetch("https://anisongdb.com/api/search_request", options);
    const data = await response.json()
    await waitTimeout(3);

    return data;
}


function checkForExistance(result, annID) {
    try {
        result = sortResultsByID(result);
        result = result[annID];

        if (result === undefined) {
            result = [];
        }

        else {
            result = [result];
        }

    }
    catch {
        result = [];
    }

    return result;
}


function sortResultsByID(results) {
    const mappedResults = {};

    if (!Array.isArray(results)) {
        results = [results];
    }

    for (let result of results) {
        if (!mappedResults.hasOwnProperty(result.annId)) {
            mappedResults[result.annId] = mapResult(result);
        }

        if ((englishDubArtists.some((artist) => result.songArtist.includes(artist)))) {
            continue;
        }

        let type = ((result.songType.split(" "))[0]).toLowerCase();
        mappedResults[result.annId]["music"][type].push(mapSong(result, mappedResults[result.annId]["music"]["insert"].length))
        mappedResults[result.annId]["englishName"] = (result.animeENName || null);
        mappedResults[result.annId]["japaneseName"] = (result.animeJPName || null);
    }

    return mappedResults;
}


function mapResult(result) {
    return {
        music: {
            opening: [],
            ending: [],
            insert: []
        },
        annId: result.annId
    }
}


function mapSong(result, insertCounter) {
    let number = Number.parseInt((result.songType.split(" "))[(result.songType.split(" ")).length - 1]);

    if (Number.isNaN(number)) {
        number = insertCounter + 1;
    }

    return {
        "title": result.songName,
        "artist": result.songArtist,
        "number": number,
        "audioLink": result.audio
    }
}





export async function searchAnisongDBtitle(animeTitle, animeInfo, cacheFilter) {

    let animeTitleSplit = sanitizeEnglishTitle(animeTitle).split(" ").filter((entry) => entry !== "");
    let result = [];

    while (result.length === 0 && animeTitleSplit.length > 0) {
        result = await searchAnisongDBByFilename(animeTitleSplit.join(" "));
        animeTitleSplit.splice(-1);
    }

    result = sortResultsByID(result);

    if (result.length === 0) {
        return null;
    }
    else if (result.length === 1) {
        return result[0];
    }
    else {
        result = Object.values(result).map((entry) => {

            let enDist = Number.MAX_SAFE_INTEGER, jpDist = Number.MAX_SAFE_INTEGER;

            if (entry.englishName != null && animeInfo.englishTitle != null) {
                let enSan = sanitizeEnglishTitle(entry.englishName).toLowerCase().split(" ").filter((entry) => entry != "").join(" ");
                let enMALSan = sanitizeEnglishTitle(animeInfo.englishTitle).toLowerCase().split(" ").filter((entry) => entry != "").join(" ");

                enDist = distance(enSan, enMALSan);
            }

            if (entry.japaneseName != null) {
                let jpSan = sanitizeEnglishTitle(entry.japaneseName).toLowerCase().split(" ").filter((entry) => entry != "").join(" ");
                let jpMALSan = sanitizeEnglishTitle(animeInfo.title).toLowerCase().split(" ").filter((entry) => entry != "").join(" ");

                jpDist = distance(jpSan, jpMALSan);
            }

            entry["enDist"] = enDist;
            entry["jpDist"] = jpDist;

            return entry;
        }).sort((entryA, entryB) => {
            if (entryA.enDist === entryB.enDist || entryA.enDist === Number.MAX_SAFE_INTEGER || entryB.enDist === Number.MAX_SAFE_INTEGER) {
                return entryA.jpDist - entryB.jpDist;
            }
            return entryA.enDist - entryB.enDist
        }).filter((entry) => {
            if (entry.music.opening.length >= cacheFilter["Opening"] &&
                entry.music.ending.length >= cacheFilter["Ending"] &&
                entry.music.insert.length >= cacheFilter["Insert"]) {
                return true;
            }
            else return false;
        })

        if (result.length > 0) {
            return result[0].music;
        }
    }

    return null;
}


async function searchAnisongDBByFilename(animeTitle) {
    updateRequest(animeTitle, "", "", false);
    const response = await fetch("https://anisongdb.com/api/search_request", options);
    const data = await response.json()
    await waitTimeout(3);

    return data;
}








function updateRequest(animeTitle, artist, songName, andLogic) {

    let body = {
        and_logic: andLogic,
        ignore_duplicate: false,
        opening_filter: true,
        ending_filter: true,
        insert_filter: true,
    };

    if (animeTitle !== "") {
        body["anime_search_filter"] = {
            search: animeTitle,
            partial_match: true
        }
    }
    else { delete body["anime_search_filter"] }

    if (artist !== "") {
        body["artist_search_filter"] = {
            group_granularity: 0,
            max_other_artist: 99,
            partial_match: false,
            search: artist
        }
    }
    else { delete body["artist_search_filter"] }

    if (songName !== "") {
        body["song_name_search_filter"] = {
            partial_match: false,
            search: songName
        }
    }
    else { delete body["song_name_search_filter"] }

    options.body = JSON.stringify(body);
}







export async function runTestMode(filename, finalizedInformation) {

    let tempANNid = await reverseGrab(filename);

    let possibleFailure = {
        "filename": filename,
        "annID": finalizedInformation.annID,
        "anisongDBannID": tempANNid
    }

    testValidity(finalizedInformation.annID, tempANNid, possibleFailure);

    return;
}


async function reverseGrab(filename) {
    try {
        const tags = await getTags(filename);
        updateRequest("", tags.artist, tags.title, true);

        const response = await fetch("https://anisongdb.com/api/search_request", options);
        const data = await response.json()
        await waitTimeout(3);

        return data;
    }
    catch { return -1 }
}