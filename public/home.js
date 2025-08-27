$(document).ready(() => {
  const url = window.location.search;
  const urlParams = new URLSearchParams(url);
  const theme = urlParams.get("theme") || "default";

  if (theme == "dark") {
    $("body").addClass("_dark-mode");
    $(".offer a").attr("href", "index.html?theme=dark");
  }

  $("body").addClass("loaded_hiding");
  setTimeout(() => {
    $("body").addClass("loaded");
    $("body").removeClass("loaded_hiding");
  }, 500);
});

$(".about__button").click(() => {
  $("#popup-about").addClass("_active");
  $("body").addClass("_lock");
});

$(".cite-btn").click(() => {
  $("#popup-cite").addClass("_active");
  $("body").addClass("_lock");
});

$(".popup__close").click(() => {
  $(".popup").removeClass("_active");
  $("body").removeClass("_lock");
});

$(".popup").click(function (e) {
  if (e.target === this) {
    $(this).removeClass("_active");
    $("body").removeClass("_lock");
  }
});

$(".arrow._down").click(() => {
  $(".modules")[0].scrollIntoView({ behavior: "smooth" });
});

$(".arrow._up").click(() => {
  $(".variable__container")[0].scrollIntoView({ behavior: "smooth" });
});

$(".dark-mode-button").click(() => {
  $("body").toggleClass("_dark-mode");
  if ($("body").hasClass("_dark-mode")) {
    $(".offer a").attr("href", "index.html?theme=dark");
  } else {
    $(".offer a").attr("href", "index.html");
  }
});

// $(window).on("scroll", function () {
//   if (window.scrollY > $(window).height()) {
//     $(".dark-mode-button").addClass("_visible");
//   }
//   if (window.scrollY < $(window).height()) {
//     $(".dark-mode-button").removeClass("_visible");
//   }
// });
