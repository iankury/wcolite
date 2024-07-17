async function Initialize() {
  await ReadUnifiedJson();
  await ReadTree();
  console.log("Read Mysql.\n");

  BuildQueryToNode();

  app.use(express.static("public", { index: "home.html" }));
  app.listen(process.env.PORT || 3000);

  app.get("/q/:id", (req, res) => {
    if (req.params.id.length > 1000) res.sendStatus(400);
    else {
      const decodedQuery = decode(req.params.id);
      if (decodedQuery.length > 80) res.sendStatus(400);
      else res.status(201).send(Process(decodedQuery));
    }
  });
  app.get("/t", (req, res) => {
    res.status(201).send(jsonTree);
  });
  app.get(update_data_pwd, (req, res) => {
    ReadUnifiedJson();
    ReadTree();
    BuildQueryToNode();
    res.sendFile("public/updating.html", { root: __dirname });
  });
}

const express = require("express"),
  app = express();
const fs = require("fs");
const levenshtein = require("js-levenshtein");
const LRU = require("lru-cache");
const mysql = require('mysql');
const util = require('util');

const decode = (s) => s
    .split("a")
    .map((x) => String.fromCharCode(x))
    .join("");
const StripDagger = (s) => {
  if (s.charCodeAt(0) == 8224) s = s.substr(1).trim();
  return s;
};
const StripAuthorship = (s) => s.replace(/[,()&]/g, "");
const IsDigitCode = (n) => n >= "0".charCodeAt(0) && n <= "9".charCodeAt(0);

const db_pwd = fs.readFileSync("db_pwd.txt").toString();
const update_data_pwd = fs.readFileSync("update_data_pwd.txt").toString();
const mysqlConnection = GetMysqlConnection();
const mysqlQuery = util.promisify(mysqlConnection.query).bind(mysqlConnection);

const cache = new LRU(10000);

let unifiedJson = {};
let jsonTree;
let queryToNode = {};

const kPageSize = 15;

Initialize();

function Process(query) {
  const pageNumber = parseInt(query.substr(0, 4));
  query = StripDagger(query.substr(4));

  let ans = {
    approximation: false,
    didYouMean: "",
    resultList: [],
    pages: 1,
  };
  if (queryToNode[query]) ans.resultList = Array.from(queryToNode[query]);
  else {
    const fromCache = cache.get(query);
    if (fromCache) {
      ans = fromCache;
    } else {
      ans.resultList = SubstringMatch(query);
      if (ans.resultList.length == 0) {
        ans.approximation = true;
        ans.didYouMean = BestApproximation(query);
      }
      cache.set(query, ans);
    }
  }

  if (!ans.approximation) {
    const tempString = JSON.stringify(ans);
    const ansDeepCopy = JSON.parse(tempString);
    ansDeepCopy.pages = Math.ceil(ansDeepCopy.resultList.length / kPageSize);
    const st = pageNumber * kPageSize;
    ansDeepCopy.resultList = ansDeepCopy.resultList.slice(st, st + kPageSize);
    return JSON.stringify(ansDeepCopy);
  }

  return JSON.stringify(ans);
}

function SubstringMatch(s) {
  let ans = new Set();
  Object.entries(queryToNode).forEach((x) => {
    const key = x[0];
    const value = x[1];
    if (value && !IsDigitCode(key.charCodeAt(0)) && key.includes(s))
      ans = new Set([...ans, ...value]);
  });
  return Array.from(ans);
}

function BestApproximation(s) {
  let ans = "";
  let best = 99999;
  for (const key of Object.keys(queryToNode)) {
    if (IsDigitCode(key.charCodeAt(0))) continue;
    const distance = levenshtein(s, key);
    if (distance < best) {
      best = distance;
      ans = key;
    }
  }
  return ans;
}

function AddToTable(key, x) {
  if (!(key in queryToNode)) queryToNode[key] = new Set();
  queryToNode[key].add(x);
}

function BuildQueryToNode() {
  Object.values(unifiedJson).forEach((x) => {
    if (x["cached"] && x["author_year"]) {
      const sciname = x["cached"].toLowerCase();
      AddToTable(sciname, x);
      const authorship = x["author_year"].toLowerCase();
      AddToTable(authorship, x);
      const tokens = StripAuthorship(authorship).split(" ");
      tokens.forEach((token) => AddToTable(token, x));
    }
  });
  Object.values(unifiedJson).forEach((x) => {
    if (x["original"] && x["original"] != "") {
      const s = x["original"].toLowerCase();
      if (!queryToNode[s])
        queryToNode[s] = queryToNode[x["cached"].toLowerCase()];
    }
  });
}

function GetMysqlConnection() {
  return mysql.createConnection({
    host: "nw71.fcomet.com",
    user: "wcolitec_pinhata",
    password: db_pwd,
    database: "wcolitec_pinhadb"
  });
}

async function ReadUnifiedJson() {
  const jsonArray = await mysqlQuery("SELECT * FROM unified_json;");

  unifiedJson = {}
  for (jsonObject of jsonArray) {
    if (!jsonObject["id"]) continue;

    unifiedJson[jsonObject["id"]] = JSON.parse(jsonObject["full_json"]);
  }
}

async function ReadTree() {
  const jsonArray = await mysqlQuery("SELECT * FROM tree WHERE id = 1;");
  jsonTree = jsonArray[0]["full_json"];
}
