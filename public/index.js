let jsonTree, data;
let mode = "tree";
const columns = ["Scientific name", "Authorship", "Rank", "AncesTREE"];
let dragCurX = 0,
  dragCurY = 0,
  dragRunning = false;
let lastQuery = "",
  backupQuery = "";

const encode = (s) =>
  s
    .split("")
    .map((x) => x.charCodeAt(0))
    .join("a");
const stripTags = (s) => s.replace(/(<([^>]+)>)/gi, "");
const isItalic = (s) => s.indexOf("<i>") != -1;

$(document).ready(() => {
  $("body").addClass("loaded_hiding");

  setInitialMode();

  $.get("/t", (data) => {
    if (!data) {
      $("body").html(`<div class="loading_container"><img></div>`);
      return;
    }
    jsonTree = JSON.parse(data);
    loadedTree();
  });
});

function loadedTree() {
  addListeners();

  // TO DO: use alternative tree if mobile mode

  setTreeDrag();
  currentContainerOnly();
  $("#data-tree__container").append(Chart()).find("svg").addClass("tree_chart");

  addTreeRightClick();

  $("body").addClass("loaded");
  $("body").removeClass("loaded_hiding");
}

function setInitialMode() {
  const url = window.location.search;
  const urlParams = new URLSearchParams(url);
  const defaultMode = window.innerHeight > window.innerWidth ? "card" : "tree";
  const initialMode = urlParams.get("mode") || defaultMode;
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
    }
  });
  $("#sidebar__search-button").on("click", () => {
    extractQuery();
    sendFirstPage();
    $(".sidebar").addClass("_closed");
  });
  $("#options__tree").on("click", () => {
    setMode("tree");
  });
  $("#options__card").on("click", () => {
    setMode("card");
    sendPlaceholderPage();
  });
  $("#options__table").on("click", () => {
    setMode("table");
    sendPlaceholderPage();
  });
  $(".mean__options-no").on("click", () => {
    setLastQuery(backupQuery);
    $(".data__popup-mean").removeClass("_active");
  });
  $(".mean__options-yes").on("click", () => {
    $(".data__popup-mean").removeClass("_active");
    setLastQuery(data.didYouMean);
    sendFirstPage();
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
    $("body").toggleClass("_dark-mode");
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
    $("#searchbox").addClass("_lock");
    $("#searchbox").prop("disabled", true);
    $("#sidebar__search-button").addClass("_lock");
    $("#last-query").addClass("_hide");
    $(".data-header").addClass("_transparent");

    if (window.innerHeight > window.innerWidth) {
      $(".sidebar").addClass("_closed");
      $("#data").css("overflow", "hidden");
    }
  } else {
    $("#searchbox").removeClass("_lock");
    $("#searchbox").prop("disabled", false);
    $("#sidebar__search-button").removeClass("_lock");
    $("#last-query").removeClass("_hide");
    $(".data-header").removeClass("_transparent");
  }
}

function setLastQuery(s) {
  lastQuery = s;
  $("#last-query span").html(lastQuery);
}

function currentContainerOnly() {
  $("#data-tree__container").hide();
  $("#data-card__container").hide();
  $("#data-table__container").hide();
  $(`#data-${mode}__container`).css("display", "flex");
}

const bullets = (v) =>
  !v || v.length < 1
    ? ""
    : `<ul>${v.map((x) => `<li>${x || "Coming soon..."}</li>`).join("")}</ul>`;

const indented = (s) => `<div style="padding-left: 3vw;">${s}</div>`;

function displayCard() {
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
}

function displayTable() {
  $("#out_of_pages").html(data.pages);
  $("#page").attr("max", data.pages);

  $(".data-table__items").empty();
  for (x of data.resultList) {
    const item = $('<div class="data-table__item"></div>');

    const name = $('<div class="data-table__name data-column"></div>');
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
  const processedName = `<p class="qlink">${x.validName}</p>`;
  return `${x.original_html} (valid: ${processedName})`;
}

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
  $("#searchbox").val("");
}

function sendFirstPage() {
  if (mode == "tree") {
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
    `Did you mean <span>${data.didYouMean}</span>?`
  );
  $(".data__popup-mean").addClass("_active");
}

function displayData() {
  if (mode == "table") displayTable();
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
