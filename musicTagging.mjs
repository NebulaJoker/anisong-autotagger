import id3 from 'node-id3';
import fs from 'fs';

async function clearTags(song) {
    id3.removeTags("anisongs/" + song)
}


export async function burnMP3(song, finalizedInformation, image, trackInformation, songType) {

    clearTags(song);

    try {
        finalizedInformation["genres"].push(songType)
        const tags = {
            "album": finalizedInformation["title"],
            "genre": finalizedInformation["genres"].join(";"),
            "title": trackInformation["title"],
            "artist": trackInformation["artist"],
            "trackNumber": trackInformation["number"],
            "year": finalizedInformation["year"],
            image: {
                mime: "png/jpeg" / undefined,
                type: {
                    id: 3,
                    name: "front cover"
                },
                description: "MAL Art",
                imageBuffer: fs.readFileSync(image)
            },
        }
        const success = id3.write(tags, "anisongs/" + song);
        finalizedInformation["genres"].splice(-1);
        return success;
    }

    catch (err) {
        console.log(err);
        return false;
    }

}


export async function getTags(song) {
    let a = id3.read("anisongs/" + song);
    return {
        "artist": a.artist,
        "title": a.title,
        "album": a.album
    };
}