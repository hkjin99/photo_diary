// 사진 라이트박스: 클릭으로 열고, ← → / 화면 버튼 / 밀기로 넘긴다.
(function () {
  const cells = Array.from(document.querySelectorAll(".cell"));
  if (!cells.length) return;

  const box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML =
    '<img alt="">' +
    '<button class="lb-btn lb-prev" aria-label="이전 사진">‹</button>' +
    '<button class="lb-btn lb-next" aria-label="다음 사진">›</button>' +
    '<button class="lb-btn lb-close" aria-label="닫기">×</button>' +
    '<div class="lb-info"><p class="lb-caption"></p><p class="lb-meta"></p></div>';
  document.body.appendChild(box);

  const image = box.querySelector("img");
  let current = 0;
  const fullUrl = (cell) => cell.querySelector("a.photo").href;
  // 암호화된 사이트에서는 lock.js가 사진을 복호화해 준다
  const resolve = window.diaryLoad || ((url) => Promise.resolve(url));

  function show(index) {
    current = (index + cells.length) % cells.length;
    const cell = cells[current];
    const shown = current;
    const place = cell.closest(".moment").dataset.place;
    const caption = cell.querySelector("figcaption");
    image.removeAttribute("src");
    resolve(fullUrl(cell)).then((url) => {
      if (shown === current && box.classList.contains("open")) image.src = url;
    });
    box.querySelector(".lb-caption").textContent = caption ? caption.textContent : "";
    box.querySelector(".lb-meta").textContent =
      `${cell.dataset.time}${place ? " · " + place : ""}  —  ${current + 1} / ${cells.length}`;
    resolve(fullUrl(cells[(current + 1) % cells.length])).then((url) => {
      new Image().src = url;
    });
  }

  function close() {
    box.classList.remove("open");
    image.removeAttribute("src");
    cells[current].querySelector("a.photo").focus();
  }

  cells.forEach((cell, index) => {
    cell.querySelector("a.photo").addEventListener("click", (event) => {
      event.preventDefault();
      box.classList.add("open");
      show(index);
    });
  });

  box.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
  box.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
  box.querySelector(".lb-close").addEventListener("click", close);
  image.addEventListener("click", () => show(current + 1));
  box.addEventListener("click", (event) => {
    if (event.target === box) close();
  });

  document.addEventListener("keydown", (event) => {
    if (!box.classList.contains("open")) return;
    if (event.key === "ArrowRight") show(current + 1);
    else if (event.key === "ArrowLeft") show(current - 1);
    else if (event.key === "Escape") close();
  });

  let touchStart = null;
  box.addEventListener("touchstart", (event) => {
    touchStart = event.changedTouches[0].clientX;
  });
  box.addEventListener("touchend", (event) => {
    if (touchStart === null) return;
    const moved = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(moved) > 50) show(current + (moved < 0 ? 1 : -1));
    touchStart = null;
  });
})();
