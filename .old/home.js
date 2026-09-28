// Objective is to display the visitor count - through js (not possible on github as it serves static pages)
// (try using the cloudflare pages later - for now just display it)

fetch("count.txt")
  .then(response => response.text())
  .then(count => {
    document.getElementById("counter").textContent =
      `You are visitor #${count}`;
  });