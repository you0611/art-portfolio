// Keep the checked-in artwork page as a complete fallback, then replace only its
// primary image when the server has a verified uploaded version.
(async () => {
  const image = document.querySelector(".detail-image img");
  if (!image) return;
  const filename = location.pathname.split("/").pop() || "";
  const artworkId = filename.replace(/-en\.html$/i, "").replace(/\.html$/i, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(artworkId)) return;
  const fallback = image.getAttribute("src");
  try {
    const response = await fetch("/api/artworks", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const body = await response.json();
    const artwork = (body.artworks || []).find((item) => item.id === artworkId);
    if (!artwork?.image || artwork.image === fallback) return;
    image.addEventListener("error", () => {
      image.src = fallback;
    }, { once: true });
    image.src = artwork.image;
  } catch {
    // The static image remains visible when the API or network is unavailable.
  }
})();
