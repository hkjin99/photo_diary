// 암호화된 사이트 열기. 형식은 diary/encrypt.py와 맞아야 한다.
// 키는 이 탭의 sessionStorage에만 두어 탭을 닫으면 사라진다.
(function () {
  const root = document.documentElement.dataset.root || "";
  const STORE = "diary-key";
  const form = document.getElementById("unlock");
  const message = document.getElementById("message");
  const loaded = new Map(); // 원래 주소 → 복호화한 blob 주소
  let key = null;

  const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

  function readStoredKey() {
    try {
      return sessionStorage.getItem(STORE);
    } catch {
      return null;
    }
  }

  function storeKey(raw) {
    try {
      if (raw) sessionStorage.setItem(STORE, toBase64(raw));
      else sessionStorage.removeItem(STORE);
    } catch {
      // 저장이 막힌 브라우저에서는 페이지마다 비밀번호를 입력한다
    }
  }

  const importKey = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);

  async function deriveKey(password) {
    const response = await fetch(`${root}lock.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error("사이트 정보를 읽지 못했습니다.");
    const info = await response.json();
    const material = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password.normalize("NFC")), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(info.salt), iterations: info.iterations },
      material,
      256
    );
    return new Uint8Array(bits);
  }

  async function fetchAndDecrypt(url, cache) {
    const response = await fetch(`${url}.enc`, { cache });
    if (!response.ok) {
      const error = new Error("파일을 찾을 수 없습니다.");
      error.missing = true;
      throw error;
    }
    const blob = new Uint8Array(await response.arrayBuffer());
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: blob.slice(0, 12) }, key, blob.slice(12));
  }

  // 일반 사진은 화면에 가까워질 때 받는다
  async function load(url) {
    const absolute = new URL(url, document.baseURI).href;
    if (!loaded.has(absolute)) {
      const type = absolute.endsWith(".png") ? "image/png" : "image/jpeg";
      loaded.set(absolute, fetchAndDecrypt(absolute, "default").then((plain) =>
        URL.createObjectURL(new Blob([plain], { type }))));
    }
    return loaded.get(absolute);
  }

  window.diaryLoad = load;

  function watchImages() {
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
        observer.unobserve(entry.target);
        load(entry.target.dataset.enc).then((url) => {
          entry.target.src = url;
        }).catch(() => {});
      });
    }, { rootMargin: "800px" });
    document.querySelectorAll("img[data-enc]").forEach((img) => observer.observe(img));
  }

  function show(html) {
    const page = new DOMParser().parseFromString(html, "text/html");
    const scripts = Array.from(page.querySelectorAll("script[src]")).map((s) => s.getAttribute("src"));
    page.querySelectorAll("script").forEach((s) => s.remove());
    page.querySelectorAll("img[src]").forEach((img) => {
      img.dataset.enc = img.getAttribute("src");
      img.removeAttribute("src");
      img.removeAttribute("loading"); // 언제 받을지는 아래 watchImages가 정한다
    });

    document.title = page.title;
    document.querySelector("style").remove();
    document.head.append(...Array.from(page.head.querySelectorAll("link")).map((l) => document.adoptNode(l)));
    document.body.replaceWith(document.adoptNode(page.body));
    watchImages();

    scripts.forEach((src) => {
      const script = document.createElement("script");
      script.src = src;
      document.body.appendChild(script);
    });
  }

  async function openPage() {
    const file = location.pathname.split("/").pop() || "index.html";
    const plain = await fetchAndDecrypt(new URL(file, location.href).href, "no-cache");
    show(new TextDecoder().decode(plain));
  }

  function askPassword(text) {
    message.textContent = text || "";
    form.hidden = false;
    form.elements.password.focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    message.textContent = "확인하는 중…";
    try {
      const raw = await deriveKey(form.elements.password.value);
      key = await importKey(raw);
      await openPage();
      storeKey(raw);
    } catch (error) {
      key = null;
      message.textContent = error.missing ? error.message : error.name === "OperationError"
        ? "비밀번호가 맞지 않습니다." : error.message || "열지 못했습니다.";
      button.disabled = false;
    }
  });

  (async function start() {
    if (!window.crypto || !crypto.subtle) {
      askPassword("이 브라우저에서는 열 수 없습니다.");
      return;
    }
    const stored = readStoredKey();
    if (!stored) {
      askPassword();
      return;
    }
    try {
      key = await importKey(fromBase64(stored));
      await openPage();
    } catch (error) {
      if (!error.missing) storeKey(null); // 비밀번호가 바뀌었으면 다시 묻는다
      key = null;
      askPassword(error.missing ? error.message : "");
    }
  })();
})();
