import { createRequire } from "module";
const require = createRequire(import.meta.url);
const prompt = require('prompt-sync')({ sigint: true });


export function printInstructions() {
    console.log(`Welcome to Nebby's Anisong Autotagger.
    Select an option to continue:
    1: Normalize pathnames
    2: Tag songs
    3: Normalize pathnames + Tag songs
    4: Exit`)
}


export function parseUserOption() {
    let option = Number.parseInt(prompt("Choose an option: "));

    if (isNaN(option)) {
        option = -1;
    }

    return option;
}