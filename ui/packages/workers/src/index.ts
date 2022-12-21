import { Router } from "itty-router";
import { handleAssets } from "./assets";
import { handleInjectHead, handlePreview } from "./preview";
import { proxyRequest } from "./proxy";
import { handleLegacy, handleShare, handleView } from "./share";

const router = Router();

//passthrough
router.get("/api/login", proxyRequest);
router.post("/api/user/save", proxyRequest);
router.get("/api/share/random", proxyRequest);
// viewer files
router.post("/api/share", handleShare);
router.get("/api/share/:key", handleView);
router.get("/api/legacy-share/:key", handleLegacy); //TODO: this endpoint should be deleted once we convert over to new
router.get("/api/preview/:key", handlePreview);

// rewrite doc head
router.get("/viewer/share/:key", handleInjectHead);

router.get("/api/assets/*", handleAssets);

addEventListener("fetch", (event) => {
  event.respondWith(router.handle(event.request, event));
});