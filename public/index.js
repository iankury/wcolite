let jsonTree, data;
let mode = "tree";
const columns = ["Scientific name", "Authorship", "Rank", "AncesTREE"];
let dragCurX = 0,
  dragCurY = 0,
  dragRunning = false;
let lastQuery = "",
  backupQuery = "",
  queryTable = "";
let colorTheme = "default";
let treeLinks = {};
const helpTree = document.createElement("div");

const encode = (s) =>
  s
    .split("")
    .map((x) => x.charCodeAt(0))
    .join("a");
const stripTags = (s) => s.replace(/(<([^>]+)>)/gi, "");
const isItalic = (s) => s.indexOf("<i>") != -1;

$(document).ready(() => {
  setInitialMode();

  $.get("/t", (data) => {
    if (!data) {
      $("body").html(`<div class="loading_container"><img></div>`);
      return;
    }
    jsonTree = JSON.parse(data);
    loadedTree();
    loadedBrowse();
  });
});

function loadedBrowse() {
  jsonTree.children.forEach((el) => {
    $(".data-browse__list").append(
      `<div class="browse__sublist"><div class="browse__list-link"><div class="arrow"></div><span>${el.name}</span></div></div>`
    );
    nm = el.name;
    treeLinks[nm] = [];
    fillTreeLinks(el);
  });

  $(".data-browse__list").click((e) => {
    tg = e.target;
    if (tg.classList.contains("_opened")) {
      tg.classList.remove("_opened");
      p = $(tg).parent();
      $(p).find(".browse__sublist").remove();
    } else {
      tg.classList.add("_opened");
      elem = e.target.innerHTML;

      treeLinks[elem].forEach((el) => {
        $(tg)
          .parent()
          .append(
            `<div class="browse__sublist"><div class="browse__list-link">${el.name}</div></div>`
          );
      });
    }
  });
}

function fillTreeLinks(prnt) {
  if (prnt.children != undefined) {
    prnt.children.forEach((el) => {
      treeLinks[prnt.name].push(el);
      nm = el.name;
      treeLinks[nm] = [];
      fillTreeLinks(el);
    });
  } else return;
}

function viewChildrenBrowse(el) {}

function loadedTree() {
  addListeners();
  // TO DO: use alternative tree if mobile mode
  setTreeDrag();
  currentContainerOnly();

  helpTree.classList.add("data-help");
  helpTree.innerHTML = `<div class="help-header">
          <p>How to use</p>
          <div class="help-close">
            <svg x="0px" y="0px" viewBox="0 0 24 24">
              <path d="M 4.9902344 3.9902344 A 1.0001 1.0001 0 0 0 4.2929688 5.7070312 L 10.585938 12 L 4.2929688 18.292969 A 1.0001 1.0001 0 1 0 5.7070312 19.707031 L 12 13.414062 L 18.292969 19.707031 A 1.0001 1.0001 0 1 0 19.707031 18.292969 L 13.414062 12 L 19.707031 5.7070312 A 1.0001 1.0001 0 0 0 18.980469 3.9902344 A 1.0001 1.0001 0 0 0 18.292969 4.2929688 L 12 10.585938 L 5.7070312 4.2929688 A 1.0001 1.0001 0 0 0 4.9902344 3.9902344 z"></path>
            </svg>
          </div>
        </div>
        <div class="help-content">
          <div class="help-content__item">
            <p>The tree is draggable.</p>
          </div>
          <div class="help-content__item">
            <p><span>Left click </span>to navigate tree.</p>
          </div>
          <div class="help-content__item">
            <p><span>Right click </span>to view a taxon's card.</p>
          </div>
        </div>`;

  if (colorTheme == "dark") {
    setDarkMode();
    $(".header__logo a").attr("href", "home.html?theme=dark");
  } else {
    $("#data-tree__container")
      .append(Chart())
      .find("svg")
      .addClass("tree_chart");
    $(".data-help").find("svg").removeClass("tree_chart");
  }

  addTreeRightClick();
  addBrowseRightClick();

  hideLoader();
}

function showLoader() {
  $("body").removeClass("loaded");
}

function hideLoader() {
  $("body").addClass("loaded_hiding");
  $("body").addClass("loaded");
  $("body").removeClass("loaded_hiding");
}

function setInitialMode() {
  const url = window.location.search;
  const urlParams = new URLSearchParams(url);
  const defaultMode = window.innerHeight > window.innerWidth ? "card" : "tree";
  const initialMode = urlParams.get("mode") || defaultMode;
  const theme = urlParams.get("theme") || "default";
  colorTheme = theme;
  setMode(initialMode);
  updateRadio();
  if (initialMode != "tree") sendPlaceholderPage();
  history.pushState({}, null, "/");
}

function addListeners() {
  $("#searchbox").on("keypress", (e) => {
    if (e.keyCode == 13) {
      extractQuery();
      sendFirstPage();
      setMode("table");
    }
  });
  $("#header__search-button").on("click", () => {
    extractQuery();
    sendFirstPage();
    setMode("table");
    closeMenuMobile();
    $(".sidebar").addClass("_closed");
  });
  $(".to-tree").on("click", () => {
    setMode("tree");
    closeMenuMobile();
    $(".to-tree").addClass("_active");
    $(".to-browse").removeClass("_active");
  });
  $(".to-table").on("click", () => {
    setMode("table");
    closeMenuMobile();
  });
  $(".to-browse").on("click", () => {
    setMode("browse");
    closeMenuMobile();
    $(".to-browse").addClass("_active");
    $(".to-tree").removeClass("_active");
  });
  $(".mean__options-no").on("click", () => {
    setLastQuery(backupQuery);
    $(".data__popup-mean").removeClass("_active");
  });
  $(".mean__options-yes").on("click", () => {
    $(".data__popup-mean").removeClass("_active");
    setLastQuery(data.didYouMean);
    sendFirstPage();
    setMode("table");
  });
  $("#page").on("change", () => {
    const mn = +$("#page").attr("min");
    const mx = +$("#page").attr("max");
    const cur = +$("#page").val();
    if (cur >= mn && cur <= mx) {
      const processedPageNum = (cur - 1).toString().padStart(4, "0");
      sendMessage(processedPageNum);
    }
  });
  $("#data").on("contextmenu", (e) => e.preventDefault());
  $("#search__close").on("click", () => {
    $(".sidebar").addClass("_closed");
  });
  $("#search__open").on("click", () => {
    $(".sidebar").removeClass("_closed");
  });

  $(".dark-mode-button").click(() => {
    if ($("body").hasClass("_dark-mode")) {
      offDarkMode();
      $(".header__logo a").attr("href", "home.html");
    } else {
      setDarkMode();
      $(".header__logo a").attr("href", "home.html?theme=dark");
    }
  });

  $(".query input").focus(() => {
    $(".query").addClass("_focus");
  });
  $(".query input").focusout(() => {
    $(".query").removeClass("_focus");
  });
  $(".menu-icon").click(() => {
    if ($(".header").hasClass("_closed")) {
      openMenuMobile();
    } else {
      closeMenuMobile();
    }
  });
  $(".data-help").click(() => {
    $(".data-help").addClass("_closed");
  });
}

function closeMenuMobile() {
  $(".header").addClass("_closed");
  $(".menu-icon").removeClass("_opened");
}

function openMenuMobile() {
  $(".header").removeClass("_closed");
  $(".menu-icon").addClass("_opened");
}

function setDarkMode() {
  $("body").addClass("_dark-mode");
  $("#data-tree__container").empty();
  $("#data-tree__container")
    .append(Chart("dark"))
    .append(helpTree)
    .find("svg")
    .addClass("tree_chart");
  $(".data-help").find("svg").removeClass("tree_chart");
  addTreeRightClick();
  $(".data-help").click(() => {
    $(".data-help").addClass("_closed");
  });
}

function offDarkMode() {
  $("body").removeClass("_dark-mode");
  $("#data-tree__container").empty();
  $("#data-tree__container")
    .append(Chart())
    .append(helpTree)
    .find("svg")
    .addClass("tree_chart");
  $(".data-help").find("svg").removeClass("tree_chart");
  addTreeRightClick();
  $(".data-help").click(() => {
    $(".data-help").addClass("_closed");
  });
}

function sendPlaceholderPage() {
  if (!lastQuery) {
    if (mode == "table") setLastQuery("mello-leitão");
    else setLastQuery("cryptogeobiidae");
  }
  sendFirstPage();
}

function setMode(s) {
  mode = s;
  currentContainerOnly();
  updateHowTo();
  $("#data").css("overflow", "auto");
  if (s == "tree") {
    $("#last-query").addClass("_hide");
    $(".data-header").addClass("_transparent");

    if (window.innerHeight > window.innerWidth) {
      $(".sidebar").addClass("_closed");
      $("#data").css("overflow", "hidden");
    }
  } else {
    $("#last-query").removeClass("_hide");
    $(".data-header").removeClass("_transparent");
  }
}

function setLastQuery(s) {
  lastQuery = s;

  $("#last-query span").html(queryTable);
}

function currentContainerOnly() {
  $("#data-tree__container").hide();
  $("#data-card__container").hide();
  $("#data-table__container").hide();
  $("#data-browse__container").hide();
  $("#data__popup-mean").hide();
  $(`#data-${mode}__container`).css("display", "flex");
}

const bullets = (v) =>
  !v || v.length < 1
    ? ""
    : `<ul>${v.map((x) => `<li>${x || "Coming soon..."}</li>`).join("")}</ul>`;

const indented = (s) => `<div style="padding-left: 3vw;">${s}</div>`;

let imgsSrc = {};

function displayCard() {
  $("#card__imgs").empty();
  $("#data-card__img-fullscreen").hide();

  let node;
  for (i = 0; i < data.resultList.length; i++)
    if (data.resultList[i].valid) {
      node = data.resultList[i];
      break;
    }

  $(".data-card__title").html(`${node.cached_html} ${node.author_year}`);
  $(".data-card__path").html(bullets(node.ancestree));
  $("#valid_species_count").html(node.speciesCount);
  if (node.lsid_url)
    $("#lsid_div").html(
      `<a target="_blank" class="brown_link" href="${node.lsid_url}">${node.lsid_urn}</a>`
    );
  else $("#lsid_div").html("Coming soon...");

  logonymyText = "";

  node.protonyms.sort((a, b) => {
    return a.year - b.year;
  });

  for (protonym of node.protonyms) {
    logonymyText +=
      (protonym["type_species"]
        ? indented(bullets([protonym["msg"]]))
        : bullets([protonym["msg"]])) +
      indented(
        bullets(protonym["aponyms"]) + bullets(protonym["relationships"])
      );
  }
  $("#logonymy").html(logonymyText + bullets(node["unmatched"]));
  $("#references").html(bullets(node.references));
  if (!node.children_names) $("#children_container").html("None");
  else {
    let tempChildren = "";
    const last = node.children_names.length - 1;
    for (i = 0; i < node.children_names.length; i++) {
      const comma = i == last ? "" : ",&nbsp;&nbsp;";
      const x = node.children_names[i];
      const el = `<p class="qlink">${x}${comma}</p>`;
      tempChildren += el;
    }
    $("#children_container").html(tempChildren);
  }

  if (node.depictions) {
    if (node.depictions.length) {
      node.depictions.reverse()

      $(".card__img-container").show();
      imgsSrc = node.depictions;

      let i = 0;
      for (img of node.depictions) {
        i == 0 ? (cls = "card-img__item _active") : (cls = "card-img__item");
        $(
          `<img src=${img.src.thumb} class="${cls} slider__item" data-id="${i}" loading="lazy"/>`
        ).appendTo("#card__imgs");

        i++;
      }


      setBigImg(0);
      $("#card__imgs").on("click", (e) => {
        if (e.target.classList.contains("card-img__item")) $el = e.target;
        const i = $el.getAttribute("data-id");
        setBigImg(i);
      });

      $("#set-fullscreen").on("click", setFulscreen);
      $("#close-fullscreen").hide();

      $(".img-arrow").off("click").on("click", setIdx);
    } else {
      $(".card__img-container").hide();
    }
  } else {
    $(".card__img-container").hide();
  }
}

function setIdx(e) {
  const $el = $(".card-img-big")[0];
  let curIdx = Number($el.getAttribute("data-id"));

  const lastIdx = imgsSrc.length - 1;
  if (e.target.classList.contains("arrow-right")) {
    curIdx++;
    if (curIdx > lastIdx) curIdx = 0;
  } else if (e.target.classList.contains("arrow-left")) {
    curIdx--;
    if (curIdx < 0) curIdx = lastIdx;
  }
  setBigImg(curIdx);
}

function checkBordersSlider() {
  $(".img-arrow").removeClass("_blocked");

  const $el = $(".card-img-big")[0];
  let curIdx = Number($el.getAttribute("data-id"));
  const lastIdx = imgsSrc.length - 1;

  if (curIdx == lastIdx) $(".arrow-right").addClass("_blocked");
  if (curIdx == 0) $(".arrow-left").addClass("_blocked");
}

function setBigImg(idx) {
  $("#card__img-big .card-img-big").remove();

  $(".card-img__item").removeClass("_active");

  thumbs = $(".card-img__item");

  thumbs[idx].classList.add("_active");

  $(".slider-wrapper").animate(
    { scrollLeft: $(thumbs[idx]).position().left },
    400
  );

  $(".card__img-container").hasClass("_full-screen")
    ? (html = `<img src=${imgsSrc[idx]["src"]["original"]} class="card-img-big" data-id="${idx}" />`)
    : (html = `<img src=${imgsSrc[idx]["src"]["medium"]} class="card-img-big" data-id="${idx}" />`);

  $(html).appendTo("#card__img-big");

  $(".card__img-caption").text(`${imgsSrc[idx]["caption"]}`);
  if (imgsSrc[idx]["src"]["attr"])
    $(`<p>${imgsSrc[idx]["src"]["attr"]}<p/>`).appendTo(".card__img-caption");

  checkBordersSlider();
}

function setFulscreen() {
  $(".card__img-container").addClass("_full-screen");

  const $el = $(".card-img-big")[0];
  let curIdx = Number($el.getAttribute("data-id"));

  setBigImg(curIdx);

  $("#set-fullscreen").hide();
  $("#close-fullscreen").show();

  $("#close-fullscreen").on("click", removeFullscreen);
}

function removeFullscreen() {
  $(".card__img-container").removeClass("_full-screen");
  $("#set-fullscreen").show();
  $("#close-fullscreen").hide();
}

// Triconobunus horridus
// Mischonyx parvus
// Giljarovia rossica

function displayTable() {
  $("#out_of_pages").html(data.pages);
  $("#page").attr("max", data.pages);

  $(".data-table__items").empty();
  for (x of data.resultList) {
    const item = $('<div class="data-table__item"></div>');

    let name = $(
      '<div class="data-table__name qlink _valid data-column"></div>'
    );

    if (!x["valid"]) {
      name = $('<div class="data-table__name data-column"></div>');
    }
    name.html(x["valid"] ? x["original_html"] : addLinkToValid(x));

    const authorship = $(
      '<div class="data-table__authorship data-column"></div>'
    );
    authorship.html(x["author_year"]);

    const rank = $('<div class="data-table__rank data-column"></div>');
    rank.html(x["rank"]);

    const ancestree = $('<div class="data-table__ances data-column"></div>');
    ancestree.html(bullets(x["ancestree"]));

    item.append(name);
    item.append(authorship);
    item.append(rank);
    item.append(ancestree);

    $(".data-table__items").append(item);
  }
}

function addLinkToValid(x) {
  const processedName = `<p class="qlink _valid">${x.validName}</p>`;
  if (x.type == "Combination") {
    return `${x.original_html}<div class ="valid-name-table">(protonym: ${processedName})</div>`;
  }
  return `${x.original_html}<div class ="valid-name-table">(valid: ${processedName})</div>`;
}

// function addValidName(x) {
//   const processedName = `<p class="qlink _valid">${x.validName}</p>`;

//   return `${x.original_html}<div class ="valid-name-table">(valid: ${processedName})</div>`;
// }

function moveByDelta(dX, dY) {
  dragCurX += dX;
  dragCurY += dY;
  $(".tree_chart").css({
    top: dY + parseFloat($(".tree_chart").css("top")),
    left: dX + parseFloat($(".tree_chart").css("left")),
  });
}

function setTreeDrag() {
  const mb = window.innerHeight > window.innerWidth;
  const dragOn = mb ? "touchstart" : "mousedown";
  const dragOff = mb ? "touchend" : "mouseup";
  const dragMove = mb ? "touchmove" : "mousemove";
  $("html").on(dragOff, () => {
    dragRunning = false;
  });
  $("#data-tree__container")
    .on(dragOn, (e) => {
      dragCurX = e.pageX || e.originalEvent.targetTouches[0].pageX;
      dragCurY = e.pageY || e.originalEvent.targetTouches[0].pageY;
      dragRunning = true;
      if (!mb) e.preventDefault();
    })
    .on(dragMove, (e) => {
      if (dragRunning) {
        const x = e.pageX || e.originalEvent.targetTouches[0].pageX;
        const y = e.pageY || e.originalEvent.targetTouches[0].pageY;
        moveByDelta(1.2 * (x - dragCurX), 1.4 * (y - dragCurY));
      }
    })
    .on("mousewheel", (e) => {
      moveByDelta(0, 0.8 * e.originalEvent.wheelDelta);
      e.preventDefault();
      moveByDelta(0.1, 0.1);
    });
}

function addTreeRightClick() {
  $("text").off("mouseup");
  $("text").on("mouseup", (e) => {
    if (e.which == 3) {
      const s = e.target.innerHTML;
      if (s != "Incertae Sedis") {
        setLastQuery(e.target.innerHTML);
        sendFirstPage();
      }
    }
    e.preventDefault();
  });
}

function addBrowseRightClick() {
  // $(".browse__list-link").on("click", (e) => {
  //   const s = e.target.innerHTML;
  //   console.log(s);
  //   if (s != "Incertae Sedis") {
  //     setLastQuery(e.target.innerHTML);
  //     sendFirstPage();
  //   }
  //   e.preventDefault();
  // });
}

function updateRadio() {
  $(".radio_option").removeAttr("checked");
  $(`#options__${mode}`).prop("checked", true);
}

function updateHowTo() {
  let s = "";
  if (mode == "tree")
    s = `Left click to navigate tree, right click to view a taxon's card.`;
  else if (mode == "table")
    s =
      "Left click links to use taxon as new table query, right click to view taxon cards.";
  else s = "All ancestors, as well as all children, are links.";
  $("#txt_how_to_use").html(s);
}

function extractQuery() {
  backupQuery = lastQuery;
  setLastQuery($("#searchbox").val());
  queryTable = $("#searchbox").val();
  $("#last-query span").html(queryTable);
  $("#searchbox").val("");
}

function sendFirstPage() {
  if (mode == "tree" || mode == "table") {
    setMode("card");
    updateRadio();
  }
  sendMessage("0000");
}

function sendMessage(pageNum) {
  if (lastQuery) {
    const encodedMessage = encode(`${pageNum}${lastQuery.toLowerCase()}`);
    $.get(`/q/${encodedMessage}`, receiveData);
  }
}

function receiveData(x) {
  data = JSON.parse(x);
  if (data.approximation) didYouMean();
  else {
    displayData();
    addLinkHandler();
  }
}

function didYouMean() {
  $(".data__popup-mean p").html(
    `<p>Nothing was found for your query.</p>
    <p>Perhaps did you mean <span>${data.didYouMean}</span>?<span class="mean__options-yes"></span></p>`
  );
  $(".data__popup-mean").addClass("_active");
}

function displayData() {
  if (mode == "table") displayTable();
  else if (mode == "browse");
  else if (mode == "card") {
    if (data.resultList[0].valid) displayCard();
    else {
      setMode("table");
      updateRadio();
      displayTable();
    }
  }
  currentContainerOnly();
}

function addLinkHandler() {
  $(".qlink").on("mousedown", (e) => {
    s = e.currentTarget.innerHTML;
    s = strUpTo(s, "<span");
    s = strUpTo(s, ",");
    s = stripTags(s).trim();
    setLastQuery(s);

    if (e.which == 3) {
      setMode("card");
      updateRadio();
    }

    sendFirstPage();
  });
}

function strUpTo(s, threshold) {
  idx = s.indexOf(threshold);
  if (idx >= 0) s = s.substr(0, idx);
  return s;
}
