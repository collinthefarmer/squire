import masterHtml from "./src/master/index.html";
import displayHtml from "./src/display/index.html";

const certPath = "./certs/cert.pem";
const keyPath = "./certs/key.pem";
const hasCerts =
    await Bun.file(certPath).exists() && await Bun.file(keyPath).exists();

const server = Bun.serve({
    port: 3001,
    ...(hasCerts && {
        tls: {
            cert: Bun.file(certPath),
            key: Bun.file(keyPath),
        },
    }),
    routes: {
        "/": displayHtml,
        "/master": masterHtml,
    },
    development: {
        hmr: true,
    },
});

const protocol = hasCerts ? "https" : "http";
console.log(`Display client running at ${protocol}://localhost:${server.port}`);
