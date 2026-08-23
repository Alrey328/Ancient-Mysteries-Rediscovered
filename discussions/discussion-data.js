const DISCUSSIONS = [
  {
    slug: "bull-of-heaven",
    title: "What Fell From the Sky in Ancient Mesopotamia?",
    poster: "../../What%20Fell%20from%20the%20Sky%20Poster.png",
    hubPoster: "../What%20Fell%20from%20the%20Sky%20Poster.png",
    videoUrl: "https://www.facebook.com/share/r/1EbujMyKbt/",
    discussionUrl: "./bull-of-heaven/",
    question: "Why do you think ancient Mesopotamians described catastrophe as something sent down from the heavens?"
  },
  {
    slug: "balor",
    title: "Why Did They Fear Balor's Eye?",
    poster: "../../Balor%20Why%20did%20they%20fear%20Balors%20Eye%20Poster.png",
    hubPoster: "../Balor%20Why%20did%20they%20fear%20Balors%20Eye%20Poster.png",
    videoUrl: "https://www.facebook.com/share/r/19Hxr3cqc2/",
    discussionUrl: "./balor/",
    question: "Why do you think Balor's destructive eye had to be physically restrained in the legend?"
  },
  {
    slug: "jotnar",
    title: "The Norse Thought Winter Was a Giant",
    poster: "../../The%20Norse%20thought%20Winter%20was%20Alive%20Poster.png",
    hubPoster: "../The%20Norse%20thought%20Winter%20was%20Alive%20Poster.png",
    videoUrl: "https://www.facebook.com/share/r/1AYnoo7ArJ/",
    discussionUrl: "./jotnar/",
    question: "Were the Norse simply personifying winter - or preserving a memory they believed was real?"
  },
  {
    slug: "gigantes",
    title: "Did Giants Really Walk the Earth?",
    poster: "../../Did%20Giants%20really%20walk%20%20the%20%20earth%20Poster.png",
    hubPoster: "../Did%20Giants%20really%20walk%20%20the%20%20earth%20Poster.png",
    videoUrl: "https://www.facebook.com/share/r/1EuVG4QyPF/",
    discussionUrl: "./gigantes/",
    question: "Did the ancient Greeks imagine giants purely as myth, or were they preserving a memory of something they believed once walked the earth?"
  }
];

const GISCUS_CONFIG = {
  repo: "Alrey328/Ancient-Mysteries-Rediscovered",
  repoId: "R_kgDOTkLbcQ",
  category: "",
  categoryId: "",
  mapping: "pathname",
  strict: "0",
  reactionsEnabled: "1",
  emitMetadata: "0",
  inputPosition: "top",
  theme: "transparent_dark",
  lang: "en"
};

function getDiscussion(slug) {
  return DISCUSSIONS.find((item) => item.slug === slug);
}

function renderGiscus(target, term) {
  if (!target) return;

  if (!GISCUS_CONFIG.repo || !GISCUS_CONFIG.repoId || !GISCUS_CONFIG.categoryId) {
    target.innerHTML = `
      <div class="comment-placeholder">
        <div class="tag">Comments Almost Ready</div>
        <p>GitHub Discussions still need to be enabled for this repository, then the Giscus app can connect these Fan Favorite pages to live community comments.</p>
      </div>
    `;
    return;
  }

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-repo", GISCUS_CONFIG.repo);
  script.setAttribute("data-repo-id", GISCUS_CONFIG.repoId);
  script.setAttribute("data-category", GISCUS_CONFIG.category);
  script.setAttribute("data-category-id", GISCUS_CONFIG.categoryId);
  script.setAttribute("data-mapping", GISCUS_CONFIG.mapping);
  script.setAttribute("data-term", term);
  script.setAttribute("data-strict", GISCUS_CONFIG.strict);
  script.setAttribute("data-reactions-enabled", GISCUS_CONFIG.reactionsEnabled);
  script.setAttribute("data-emit-metadata", GISCUS_CONFIG.emitMetadata);
  script.setAttribute("data-input-position", GISCUS_CONFIG.inputPosition);
  script.setAttribute("data-theme", GISCUS_CONFIG.theme);
  script.setAttribute("data-lang", GISCUS_CONFIG.lang);
  target.appendChild(script);
}
