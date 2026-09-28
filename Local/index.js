let currentScroll = window.scrollY;
let targetScroll = window.scrollY;

const ease = 0.08;

window.addEventListener("scroll", () => {
    targetScroll = window.scrollY;
});

function smoothScroll() {
    currentScroll += (targetScroll - currentScroll) * ease;

    console.log(currentScroll);

    requestAnimationFrame(smoothScroll);
}

smoothScroll();