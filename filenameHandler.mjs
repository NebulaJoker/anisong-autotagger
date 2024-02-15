import fs from 'fs'
import path from 'path'

const caseRegex = new RegExp(`[a-z][A-Z]`, 'g');
const validFilename = new RegExp(`[A-Za-z0-9 !?"'%&$#º+-]+ (OP|ED|IN)(\d+)?`);


export function normalizePathname(pathname) {

    if (pathname === "desktop.ini") return;

    if (pathname.match(validFilename)) {
        removeNCBD(pathname);
    }

    return;
}

export function normalizePathnameSeasons(pathname) {
    if (pathname === "desktop.ini") return;
    convertSeason(pathname);
    return;
}


export function getAnimeTitle(pathname) {

    if (!pathname.match(validFilename)) {
        fs.appendFileSync("logs/failed.txt", pathname + '\n');
        return null;
    }

    let bringThemDown = pathname.split(" ");
    let getMaterials = bringThemDown.slice(0, bringThemDown.length - 1);
    let rebuild = getMaterials.join(" ");

    if (rebuild.includes("/")) {
        let parts = rebuild.split("/");
        return parts[(parts.length) - 1];
    }

    return rebuild;
}


export function getSongType(string) {
    try {
        let part1 = string.split(" ");
        let TYPEnumber = part1[part1.length - 1].slice(0, -4);

        let type = TYPEnumber.slice(0, 2);
        let number = TYPEnumber.slice(2);

        if (number === "") {
            number = 1;
        }

        return {
            "type": type,
            "number": Number.parseInt(number)
        }

    }
    catch (err) {
        fs.appendFileSync("logs/no_OPED_filename.txt", string + '\n');
        return null;
    };
}


export function isValidSong(format) {

    if (!(format === ".mp3"))
        return false;

    return true;
}


function removeNCBD(pathname) {

    let newPathname = pathname.replace("-NCBD1080", "")
    let bringThemDown = newPathname.split("-");
    let rebuild = bringThemDown.join(" ");

    let spaceFrags = rebuild.replaceAll(caseRegex, (matched) => {
        return (matched[0] + " " + matched[1]);
    });

    fs.renameSync("anisongs/" + pathname, "anisongs/" + spaceFrags);

    return;
}


function convertSeason(pathname) {

    if (!(pathname.includes("S2") || pathname.includes("S3") || pathname.includes("S4") || pathname.includes("S5") || pathname.includes("S6") || pathname.includes("S7")))
        return;

    let newPathname = pathname;

    for (let i = 2; i < 11; ++i) {

        let season;

        switch (i) {
            case 2: {
                season = "2nd Season";
                break;
            }

            case 3: {
                season = "3rd Season";
                break;
            }

            default: {
                season = i + "th Season";
                break;
            }
        }

        newPathname = newPathname.replace("S" + i, season)

    }


    let bringThemDown = newPathname.split("#");
    let rebuild = bringThemDown.join(" ");

    let spaceFrags = rebuild.replaceAll(caseRegex, (matched) => {
        return (matched[0] + " " + matched[1]);
    });

    if (pathname !== spaceFrags)
        fs.renameSync("anisongs/" + pathname, "anisongs/" + spaceFrags);

}


export function sanitizeSong(filename) {

    let sanitizedSong = filename.split("\\")
    return sanitizedSong[sanitizedSong.length - 1]

}

export function mapSort(filename) {

    let a = filename.map((entry) => {
        let sanitizedSong = entry.split("\\");
        return {
            "title": entry,
            "titleClean": sanitizedSong[sanitizedSong.length - 1]
        }
    }).filter((entry) =>
        path.extname(entry.titleClean) === ".mp3").map((entry) => {
            let split = entry.titleClean.split(" ");
            let animeTitle = (split.slice(0, -1)).join(" ");
            split = split[split.length - 1];
            split = split.split(".mp3");
            split = split[0];

            entry["number"] = Number.parseInt(split.slice(2));
            entry["type"] = split.charAt(0) + split.charAt(1);
            entry["animeName"] = animeTitle;

            return entry;
        }).sort((entryA, entryB) => {
            if (entryA.animeName === entryB.animeName) {

                if (entryA.number > entryB.number) {
                    return -1
                }
                else {
                    return 1
                }
            }
            else {
                return entryA.animeName.localeCompare(entryB.animeName)
            }
        })

    return a;
}