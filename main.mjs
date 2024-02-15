'use strict'

import fs from 'fs';
import path from "path";
const __dirname = path.resolve();

import { printInstructions, parseUserOption } from "./cliModule.mjs";
import { sanitizeSong, getAnimeTitle, getSongType, mapSort, isValidSong, normalizePathname, normalizePathnameSeasons } from "./filenameHandler.mjs";
import { translateShorthand, getTrackInformation, downloadCover, waitTimeout } from "./generalUsage.mjs";
import { burnMP3 } from "./musicTagging.mjs";
import { getMALIDv5 } from "./jikanHandler.mjs";
import { searchANNtitles } from "./annHandler.mjs";
import { runTestMode, searchAnisongDB, searchAnisongDBtitle } from "./anisongDBHandler.mjs"
import { generateStatistics, noPossibleMatch } from './testSuite.mjs';


const cache = (JSON.parse(fs.readFileSync("./caches/cache.json")) || {});
const filenameCacheFilter = {};
const options = (JSON.parse(fs.readFileSync("./options.json")))


await run();


async function run() {
    printInstructions();

    while (true) {
        let option = parseUserOption();

        switch (option) {
            case 1: {
                await runNormalizer();
                break;
            }
            case 2: {
                await runTagger();
                break;
            }
            case 3: {
                await runNormalizer();
                await runTagger();
                break;
            }
            case 4: {
                process.exit();
            }
            default: {
                console.log("Invalid choice. Please retype.")
                break;
            }
        }
    }
}


async function runTagger() {

    let songList = getSongList();

    fillFilenameCache(songList);
    mapSort(songList);

    for (let song of songList) {
        if (isValidSong(path.extname(song))) {
            try {
                await anisongRoutine(song);
            }
            catch {
                console.log("An error has occured and this song was not tagged.")
                if (options.testMode) {
                    noPossibleMatch(song);
                }
            }
        }
    }

    if (options.testMode) {
        generateStatistics();
    }
    await writeCaches();
}


async function anisongRoutine(filename) {

    let sanitizedSong = sanitizeSong(filename);
    let animeTitle = getAnimeTitle(sanitizedSong);
    let songInfo = getSongType(sanitizedSong);

    let finalizedInformation = null;
    console.log("----------------- " + animeTitle + " " + songInfo.type + songInfo.number);

    if (!cache.hasOwnProperty(animeTitle)) {
        finalizedInformation = await searchInformation(animeTitle, songInfo);
    }
    else {
        finalizedInformation = cache[animeTitle];
    }

    if (finalizedInformation === null) {
        return false;
    }

    let trackInformation = getTrackInformation(songInfo.type, songInfo.number, finalizedInformation.music);

    if(options.testMode){
        return await runTestMode(filename, finalizedInformation)
    }

    if (!fs.existsSync(__dirname + "/caches/covers/" + finalizedInformation.malID + ".jpg")) {
        await downloadCover(finalizedInformation.image, finalizedInformation.malID);
        await waitTimeout(3);
    }

    let image = __dirname + "/caches/covers/" + finalizedInformation.malID + ".jpg"

    console.log(await burnMP3(filename, finalizedInformation, image, trackInformation, translateShorthand(songInfo.type)))
}



async function searchInformation(animeTitle, songInfo) {
    let finalizedInformation = await findBestMatch(animeTitle, songInfo);
    
    if (finalizedInformation.status === "success") {
        finalizedInformation = getFinalizedInformation(finalizedInformation.content);
        cache[animeTitle] = finalizedInformation;
    }

    else if (finalizedInformation.status === "failure") {
        finalizedInformation = finalizedInformation.content;

        finalizedInformation.music = await searchAnisongDBtitle(animeTitle, finalizedInformation, filenameCacheFilter[animeTitle]);

        finalizedInformation = getFinalizedInformation(finalizedInformation);
        cache[animeTitle] = finalizedInformation;
    }

    return finalizedInformation;
}


async function findBestMatch(animeTitle, songInfo) {
    let animeInfoBulk = await getMALIDv5(animeTitle);

    for (let animeInfo of animeInfoBulk) {
        console.log(animeInfo.title);

        if (animeInfo.annID == null) {
            animeInfo.annID = await searchANNtitles(animeInfo);
        }

        animeInfo.music = await searchAnisongDB(animeInfo.annID);

        if (animeInfo.music === null || !withinExpectedParameters(animeTitle, animeInfo.music)) {
            continue;
        }

        return {
            status: "success",
            content: animeInfo
        }
    }

    return {
        status: "failure",
        content: animeInfoBulk[0]
    };
}


function withinExpectedParameters(animeTitle, music) {
    let entry = filenameCacheFilter[animeTitle];
    return (music["opening"].length >= entry["Opening"] && music["ending"].length >= entry["Ending"])
}


function getFinalizedInformation(animeInfo) {
    return {
        "airdate": {
            "from": animeInfo.airdate.from,
            "to": animeInfo.airdate.to
        },
        "annID": animeInfo.annID,
        "genres": animeInfo.genres,
        "image": animeInfo.image,
        "malID": animeInfo.malID,
        "music": animeInfo.music,
        "season": animeInfo.season,
        "title": animeInfo.title,
        "type": animeInfo.type,
        "year": animeInfo.year
    }
}


function getSongList() {
    return fs.readdirSync(__dirname + "/anisongs", { recursive: true });
}


function fillFilenameCache(songList) {
    for (let song of songList) {
        if (isValidSong(path.extname(song))) {

            let sanitizedSong = sanitizeSong(song);
            let animeTitle = getAnimeTitle(sanitizedSong);
            let songInfo = getSongType(sanitizedSong);

            if (!filenameCacheFilter.hasOwnProperty(animeTitle)) {
                filenameCacheFilter[animeTitle] = {
                    "Opening": 0,
                    "Ending": 0,
                    "Insert": 0
                };
            }

            if (songInfo.number > filenameCacheFilter[animeTitle][translateShorthand(songInfo.type)])
                filenameCacheFilter[animeTitle][translateShorthand(songInfo.type)] = songInfo.number;
        }
    }
}


async function writeCaches() {
    fs.writeFileSync("./caches/cache.json", JSON.stringify(cache))
}


async function runNormalizer() {

    let songList = getSongList();

    for (let song of songList) {
        normalizePathname(song);
    }

    songList = getSongList();

    for (let song of songList) {
        normalizePathnameSeasons(song);
    }

}