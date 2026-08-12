const discussion = getDiscussion(window.DISCUSSION_SLUG);

if (!discussion) {
  document.title = "Discussion Not Found | Ancient Mysteries Rediscovered";
  document.getElementById("discussion-root").innerHTML = `
    <section class="section wrap">
      <div class="section-head">
        <span class="section-num">404</span>
        <h1>Discussion Not Found</h1>
      </div>
      <a class="text-link" href="../">View all discussions</a>
    </section>
  `;
} else {
  document.title = `${discussion.title} - Discussion | Ancient Mysteries Rediscovered`;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.content = `Join the Ancient Mysteries Rediscovered discussion for ${discussion.title}`;
  }

  const root = document.getElementById("discussion-root");
  root.innerHTML = `
    <section class="section wrap">
      <div class="discussion-detail">
        <aside class="poster-panel">
          <img src="${discussion.poster}" alt="Ancient Mysteries Rediscovered poster - ${discussion.title}" loading="lazy">
        </aside>
        <article class="discussion-body">
          <div class="section-head">
            <span class="section-num">Discussion</span>
            <span class="sub">Fan Favorite</span>
          </div>
          <h1>${discussion.title}</h1>
          <p class="question">${discussion.question}</p>
          <div class="action-row">
            <a class="text-link" href="../../">Back to Ancient Mysteries Rediscovered</a>
            <a class="text-link" href="../">View all discussions</a>
            <a class="text-link" href="${discussion.videoUrl}" target="_blank" rel="noopener">Watch the Reel</a>
          </div>
          <div class="comments" id="comments" aria-label="Community comments"></div>
        </article>
      </div>
    </section>
  `;

  renderGiscus(document.getElementById("comments"), discussion.slug);
}
