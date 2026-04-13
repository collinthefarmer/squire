import masterHtml from "./src/master/index.html";
import displayHtml from "./src/display/index.html";

const server = Bun.serve({
    port: 3001,
    routes: {
        "/": displayHtml,
        "/master": masterHtml,
    },
    development: {
        hmr: true,
    },
});

console.log(`Display client running at http://localhost:${server.port}`);
