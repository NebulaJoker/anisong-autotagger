# Anisong Autotagger

A NodeJS CLI program to tag anime songs in bulk.
Web version coming eventually.

## How to run
Just clone the repo and run
"npm install" on the root of the repository. 

Then you may fill up the "anisong" folder with mp3 files with the format "[anime name] (OP/ED/IN)[Number].mp3" 
To tag them, use "npm run tag" to run the program and follow the instructions


## How it works
The program reads the filename and takes the possible anime name from it, searching it on Jikan.
Using the Jaccard index metric, it tries to find the most appropriate entry among the search results by scanning all the titles (which sometimes makes it miss).
Then, by using the ANN link associated to the entry on MyAnimeList, the program gets the music information from AnisongDB using the ANN ID (this can also cause problems as it's impossible to establish a perfect 1:1 between the two platforms, and searching through Jikan yields better overall results) and uses the rest of information in the filename to tag it appropriately.

It also filters AnisongDB results by scanning how many OP/ED/INs you have from the same anime title in the file list (so it's recommended that they're coherent with each other) to make hit the right target more often.

It has a fallback on searching ANN with the English title if the link isn't present, and if everything fails, it searches directly on AnisongDB until it gets a valid result (or the filename runs out of words).

A cache exists to alleviate the load on all of the platforms (if you want to tag, say, the 20 OPs of Naruto Shippuden, you only need to get the information once) and simultaneously, speed up the process.

