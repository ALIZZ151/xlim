(() => {
  const splash = document.getElementById('splashScreen');
  const video = document.getElementById('splashVideo');
  const percent = document.getElementById('splashPercent');
  const bar = document.getElementById('splashBar');
  const sound = document.getElementById('splashSound');
  if (!splash) return;

  let done = false;
  const originalRemove = Element.prototype.remove;
  Element.prototype.remove = function () {
    if (this === splash && !done) return;
    return originalRemove.call(this);
  };

  document.body.classList.add('splash-lock');
  if (video) {
    video.muted = true;
    video.playsInline = true;
    video.loop = false;
    video.play && video.play().catch(() => {});
  }

  if (sound) {
    sound.addEventListener('click', () => {
      if (!video) return;
      video.muted = false;
      video.volume = 1;
      video.play && video.play().catch(() => {});
      sound.classList.add('hidden');
    });
  }

  let progress = 1;
  const started = Date.now();
  const minDuration = 12500;
  const maxDuration = 17000;
  const tick = setInterval(() => {
    const elapsed = Date.now() - started;
    const byTime = elapsed / minDuration * 100;
    const byVideo = video && video.duration ? video.currentTime / video.duration * 100 : 0;
    progress = Math.min(100, Math.max(progress, Math.floor(Math.max(byTime, byVideo))));
    if (percent) percent.textContent = progress + '%';
    if (bar) bar.style.width = progress + '%';
    if (progress >= 100 || elapsed >= maxDuration) finish();
  }, 100);

  function finish() {
    if (done) return;
    done = true;
    clearInterval(tick);
    if (percent) percent.textContent = '100%';
    if (bar) bar.style.width = '100%';
    if (sound) sound.classList.add('hidden');
    setTimeout(() => {
      document.body.classList.remove('splash-lock');
      splash.classList.add('is-hidden');
      setTimeout(() => originalRemove.call(splash), 650);
    }, 450);
  }
})();
